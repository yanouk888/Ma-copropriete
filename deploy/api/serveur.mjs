// L'API des pièces jointes de Mes copropriétés : factures, baux, photos, gardés
// sur le NAS (choix de Yannick, novembre 2026) plutôt que chez Firebase.
//
// Elle ne garde AUCUN secret. Elle vérifie deux choses à chaque requête :
//  1. le jeton Firebase de la personne, par sa signature (clés publiques de
//     Google) : on sait qui parle ;
//  2. son appartenance à la copropriété, en demandant le document à Firestore
//     AVEC SON PROPRE JETON : ce sont les règles Firestore — le seul rempart
//     déjà éprouvé — qui répondent. Pas de compte de service sur le NAS, donc
//     rien à voler.
//
// Aucune dépendance npm : rien à installer, rien qui change sous nos pieds
// entre deux constructions. Node 20 suffit (http, crypto, fs, fetch).
import http from 'node:http';
import { createPublicKey, verify, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, stat, readdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Seulement ce qu'on sait afficher, avec la signature de début de fichier qui
// le prouve : on ne resservira jamais à un navigateur un fichier qui se dit
// PDF et contient du HTML.
const TYPES = {
  'application/pdf': (o) => o.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': (o) => o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff,
  'image/png': (o) => o.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (o) => o.subarray(0, 4).toString('latin1') === 'RIFF' && o.subarray(8, 12).toString('latin1') === 'WEBP',
  // Les photos d'iPhone.
  'image/heic': (o) => o.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|mif1|msf1|heim|heis)$/.test(o.subarray(8, 12).toString('latin1')),
};
const EXTENSIONS = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

const ID_COPRO = /^[A-Za-z0-9_-]{1,64}$/;
const ID_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ───────── Jetons Firebase ─────────

const URL_CLES = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const b64url = (t) => Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Vérifie un jeton d'identité Firebase et rend l'uid, ou lève une erreur.
 * Les vérifications sont celles que Firebase documente : signature RS256 par
 * une clé publique de Google, audience et émetteur du projet, dates.
 */
export function verificateurFirebase({ projet, chargerCles = chargerClesGoogle, maintenant = () => Date.now() / 1000, emulateur = false }) {
  return async (jeton) => {
    const morceaux = String(jeton || '').split('.');
    if (morceaux.length !== 3) throw new Error('jeton mal formé');
    const entete = JSON.parse(b64url(morceaux[0]).toString('utf8'));
    const charge = JSON.parse(b64url(morceaux[1]).toString('utf8'));
    if (!emulateur) {
      if (entete.alg !== 'RS256') throw new Error('algorithme refusé');
      const cles = await chargerCles();
      const jwk = cles.find((k) => k.kid === entete.kid);
      if (!jwk) throw new Error('clé inconnue');
      const ok = verify('RSA-SHA256', Buffer.from(`${morceaux[0]}.${morceaux[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), b64url(morceaux[2]));
      if (!ok) throw new Error('signature invalide');
    }
    // L'émulateur signe pas : on n'y vérifie que le reste, et seulement si on
    // a été lancé explicitement contre lui (FIRESTORE_EMULATOR_HOST).
    const t = maintenant();
    if (charge.aud !== projet) throw new Error('audience');
    if (charge.iss !== `https://securetoken.google.com/${projet}`) throw new Error('émetteur');
    if (!(charge.exp > t)) throw new Error('jeton expiré');
    if (!(charge.iat <= t + 300)) throw new Error('jeton du futur');
    if (typeof charge.sub !== 'string' || !charge.sub) throw new Error('sujet');
    return charge.sub;
  };
}

let cacheCles = { cles: null, expire: 0 };
async function chargerClesGoogle() {
  if (cacheCles.cles && Date.now() < cacheCles.expire) return cacheCles.cles;
  const r = await fetch(URL_CLES);
  if (!r.ok) throw new Error(`clés Google indisponibles (${r.status})`);
  const age = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') || '')?.[1] || 3600);
  cacheCles = { cles: (await r.json()).keys, expire: Date.now() + age * 1000 };
  return cacheCles.cles;
}

// ───────── Appartenance, demandée à Firestore ─────────

/**
 * Demande à Firestore la liste des membres de la copropriété, avec le jeton
 * de la personne. Un non-membre se fait refuser la lecture par les règles :
 * la réponse est alors « non », sans qu'on ait rien à décider ici.
 * Une réponse positive est gardée une minute : retirer un membre prend donc
 * effet ici au plus une minute après.
 */
export function verificateurFirestore({ projet, base = 'https://firestore.googleapis.com' }) {
  const cache = new Map();
  return async (jeton, uid, coproId) => {
    const cle = `${uid}/${coproId}`;
    if ((cache.get(cle) || 0) > Date.now()) return true;
    const r = await fetch(`${base}/v1/projects/${projet}/databases/(default)/documents/copros/${coproId}?mask.fieldPaths=memberUids`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    if (r.status === 403 || r.status === 404) return false;
    if (!r.ok) throw new Error(`Firestore a répondu ${r.status}`);
    const doc = await r.json();
    const membres = (doc.fields?.memberUids?.arrayValue?.values || []).map((v) => v.stringValue);
    const membre = membres.includes(uid);
    if (membre) cache.set(cle, Date.now() + 60_000);
    return membre;
  };
}

// ───────── Le serveur ─────────

const json = (res, statut, corps) => {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corps));
};

export function creerServeur({ dossier, verifierJeton, estMembre, version, tailleMax = 15 * 1024 * 1024, quota = 2 * 1024 ** 3 }) {
  async function qui(req, coproId) {
    const jeton = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let uid;
    try { uid = await verifierJeton(jeton); } catch { return { statut: 401 }; }
    if (!ID_COPRO.test(coproId)) return { statut: 400 };
    if (!(await estMembre(jeton, uid, coproId))) return { statut: 403 };
    return { uid };
  }

  async function envoyer(req, res, coproId) {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!TYPES[type]) return json(res, 415, { erreur: 'Seuls les PDF et les images (JPEG, PNG, WebP, HEIC) sont acceptés.' });
    const annonce = Number(req.headers['content-length'] || 0);
    if (annonce > tailleMax) return json(res, 413, { erreur: 'Fichier trop gros : 15 Mo au plus.' });

    const dossierCopro = join(dossier, coproId);
    await mkdir(dossierCopro, { recursive: true });
    // Le quota protège le disque du NAS d'une copropriété qui le remplirait.
    let occupe = 0;
    for (const f of await readdir(dossierCopro)) if (!f.endsWith('.json') && !f.endsWith('.tmp')) occupe += (await stat(join(dossierCopro, f))).size;
    if (occupe + annonce > quota) return json(res, 507, { erreur: 'L\'espace de cette copropriété est plein (2 Go).' });

    const id = randomUUID();
    const temporaire = join(dossierCopro, `${id}.tmp`);
    let taille = 0;
    let debut = Buffer.alloc(0);
    let refuse = null;
    await new Promise((resoudre, rejeter) => {
      const sortie = createWriteStream(temporaire);
      req.on('data', (morceau) => {
        taille += morceau.length;
        if (debut.length < 16) debut = Buffer.concat([debut, morceau]).subarray(0, 16);
        if (taille > tailleMax && !refuse) { refuse = 413; req.unpipe(sortie); sortie.end(); req.resume(); }
      });
      req.pipe(sortie);
      sortie.on('finish', resoudre);
      sortie.on('error', rejeter);
      req.on('error', rejeter);
    });
    if (!refuse && !TYPES[type](debut)) refuse = 415;
    if (refuse) {
      await unlink(temporaire).catch(() => {});
      return json(res, refuse, { erreur: refuse === 413 ? 'Fichier trop gros : 15 Mo au plus.' : 'Le contenu du fichier ne correspond pas à son type.' });
    }
    let nom = 'piece';
    try { nom = decodeURIComponent(String(req.headers['x-nom-fichier'] || '')); } catch { /* nom illisible : on garde le nom par défaut */ }
    // Le nom ne sert qu'à l'affichage et au téléchargement : on le borne et on
    // retire ce qui pourrait se faire passer pour un chemin ou un en-tête.
    nom = nom.replace(/[\\/\r\n"]/g, '_').slice(0, 120).trim() || `piece.${EXTENSIONS[type]}`;
    const meta = { id, nom, type, taille, ajoutePar: req.uid, ajouteLe: new Date().toISOString() };
    await rename(temporaire, join(dossierCopro, id));
    await writeFile(join(dossierCopro, `${id}.json`), JSON.stringify(meta));
    return json(res, 201, meta);
  }

  async function lire(req, res, coproId, id) {
    let meta;
    try { meta = JSON.parse(await readFile(join(dossier, coproId, `${id}.json`), 'utf8')); } catch { return json(res, 404, { erreur: 'Fichier introuvable.' }); }
    res.writeHead(200, {
      'Content-Type': meta.type,
      'Content-Length': meta.taille,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.nom)}`,
      // Des factures : rien ne les garde en route, ni Cloudflare ni le navigateur.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(join(dossier, coproId, id)).pipe(res);
  }

  async function supprimer(req, res, coproId, id) {
    await unlink(join(dossier, coproId, id)).catch(() => {});
    await unlink(join(dossier, coproId, `${id}.json`)).catch(() => {});
    res.writeHead(204).end();
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, version });
      const m = /^\/api\/fichiers\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname);
      if (!m) return json(res, 404, { erreur: 'Adresse inconnue.' });
      const [, coproId, id] = m;
      if (id !== undefined && !ID_FICHIER.test(id)) return json(res, 400, { erreur: 'Identifiant de fichier invalide.' });
      const { uid, statut } = await qui(req, coproId);
      if (statut) {
        req.resume();
        return json(res, statut, { erreur: statut === 403 ? 'Vous n\'êtes pas membre de cette copropriété.' : statut === 401 ? 'Connexion requise.' : 'Requête invalide.' });
      }
      req.uid = uid;
      if (req.method === 'POST' && !id) return await envoyer(req, res, coproId);
      if (req.method === 'GET' && id) return await lire(req, res, coproId, id);
      if (req.method === 'DELETE' && id) return await supprimer(req, res, coproId, id);
      return json(res, 405, { erreur: 'Méthode non permise.' });
    } catch (erreur) {
      // Jamais le jeton ni le contenu au journal : juste ce qui a cassé.
      console.error('[api] erreur', erreur?.message);
      if (!res.headersSent) json(res, 500, { erreur: 'Erreur du serveur.' });
      else res.destroy();
    }
  });
}

// ───────── Lancement ─────────

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const projet = process.env.PROJET_FIREBASE;
  if (!projet) { console.error('PROJET_FIREBASE manquant : l\'image a été construite sans le projet Firebase.'); process.exit(1); }
  const emulateur = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  // Le numéro de l'application, le même qu'à l'écran : dans l'image,
  // package.json est copié à côté ; en développement, il est à la racine.
  let version = 'inconnue';
  for (const chemin of ['./package.json', '../../package.json']) {
    try { version = JSON.parse(await readFile(new URL(chemin, import.meta.url), 'utf8')).version; break; } catch { /* essayer le suivant */ }
  }
  const serveur = creerServeur({
    dossier: process.env.DOSSIER || '/data',
    version,
    verifierJeton: verificateurFirebase({ projet, emulateur }),
    estMembre: verificateurFirestore({ projet, base: emulateur ? `http://${process.env.FIRESTORE_EMULATOR_HOST}` : undefined }),
  });
  const port = Number(process.env.PORT || 8080);
  serveur.listen(port, () => console.log(`[api] ${version} à l'écoute sur ${port}${emulateur ? ' (émulateurs)' : ''}`));
}
