import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerServeur, verificateurFirebase } from './serveur.mjs';

// Une paire de clés à nous, qui joue le rôle des clés publiques de Google.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'cle-essai', alg: 'RS256', use: 'sig' };
const PROJET = 'projet-essai';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const maintenant = Math.floor(Date.now() / 1000);
function jeton(charge = {}, entete = {}) {
  const e = b64({ alg: 'RS256', kid: 'cle-essai', ...entete });
  const c = b64({ aud: PROJET, iss: `https://securetoken.google.com/${PROJET}`, sub: 'uid-a', iat: maintenant - 10, exp: maintenant + 3600, ...charge });
  const s = sign('RSA-SHA256', Buffer.from(`${e}.${c}`), privateKey).toString('base64url');
  return `${e}.${c}.${s}`;
}

let dossier;
let serveur;
let base;
before(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'copro-api-'));
  serveur = creerServeur({
    dossier,
    version: '9.9.9',
    verifierJeton: verificateurFirebase({ projet: PROJET, chargerCles: async () => [jwk] }),
    // uid-a est membre de « copro1 », personne d'autre de rien.
    estMembre: async (_j, uid, copro) => uid === 'uid-a' && copro === 'copro1',
    tailleMax: 1024 * 1024,
  });
  await new Promise((r) => serveur.listen(0, r));
  base = `http://127.0.0.1:${serveur.address().port}`;
});
after(async () => { serveur.close(); await rm(dossier, { recursive: true, force: true }); });

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20)]);
const envoyer = (corps, { j = jeton(), type = 'application/pdf', copro = 'copro1', nom = 'Facture été.pdf' } = {}) =>
  fetch(`${base}/api/fichiers/${copro}`, { method: 'POST', body: corps, headers: { Authorization: `Bearer ${j}`, 'Content-Type': type, 'X-Nom-Fichier': encodeURIComponent(nom) } });

test('santé : la version de l\'application', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.deepEqual(await r.json(), { ok: true, version: '9.9.9' });
});

test('un PDF : envoyé, relu à l\'identique, supprimé', async () => {
  const r = await envoyer(PDF);
  assert.equal(r.status, 201);
  const meta = await r.json();
  assert.equal(meta.nom, 'Facture été.pdf');
  assert.equal(meta.taille, PDF.length);
  const lu = await fetch(`${base}/api/fichiers/copro1/${meta.id}`, { headers: { Authorization: `Bearer ${jeton()}` } });
  assert.equal(lu.status, 200);
  assert.equal(lu.headers.get('content-type'), 'application/pdf');
  assert.equal(lu.headers.get('cache-control'), 'private, no-store');
  assert.ok(Buffer.from(await lu.arrayBuffer()).equals(PDF));
  const sup = await fetch(`${base}/api/fichiers/copro1/${meta.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${jeton()}` } });
  assert.equal(sup.status, 204);
  const apres = await fetch(`${base}/api/fichiers/copro1/${meta.id}`, { headers: { Authorization: `Bearer ${jeton()}` } });
  assert.equal(apres.status, 404);
});

test('refus : sans jeton, jeton falsifié, autre projet, expiré', async () => {
  assert.equal((await envoyer(PDF, { j: '' })).status, 401);
  const falsifie = jeton().replace(/\.[^.]+$/, '.AAAA');
  assert.equal((await envoyer(PDF, { j: falsifie })).status, 401);
  assert.equal((await envoyer(PDF, { j: jeton({ aud: 'autre-projet' }) })).status, 401);
  assert.equal((await envoyer(PDF, { j: jeton({ exp: maintenant - 1 }) })).status, 401);
  assert.equal((await envoyer(PDF, { j: jeton({}, { alg: 'none' }) })).status, 401);
});

test('refus : non-membre de la copropriété, identifiants invalides', async () => {
  assert.equal((await envoyer(PDF, { j: jeton({ sub: 'uid-b' }) })).status, 403);
  assert.equal((await envoyer(PDF, { copro: 'autre' })).status, 403);
  assert.equal((await envoyer(PDF, { copro: '..%2F..%2Fetc' })).status, 400);
  const r = await fetch(`${base}/api/fichiers/copro1/..%2Fpasswd`, { headers: { Authorization: `Bearer ${jeton()}` } });
  assert.equal(r.status, 400);
});

test('refus : type non permis, contenu qui ment sur son type, trop gros', async () => {
  assert.equal((await envoyer(Buffer.from('<html>'), { type: 'text/html' })).status, 415);
  assert.equal((await envoyer(Buffer.from('<html><script>alert(1)</script>'), { type: 'application/pdf' })).status, 415);
  const gros = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(1024 * 1024 + 10)]);
  assert.equal((await envoyer(gros)).status, 413);
});

test('une photo JPEG et un nom piégé', async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  const r = await envoyer(jpeg, { type: 'image/jpeg', nom: '../../bail"\r\nX: y.jpg' });
  assert.equal(r.status, 201);
  const meta = await r.json();
  assert.ok(!/[\\/\r\n"]/.test(meta.nom), meta.nom);
});
