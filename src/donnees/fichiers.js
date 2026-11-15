// Les pièces jointes passent par l'API du NAS (deploy/api), sous /api/ de la
// même adresse que le site. Chaque requête porte le jeton de connexion : l'API
// vérifie qui l'on est et que l'on est membre de la copropriété.
import { auth } from '../firebase';

export const TYPES_ACCEPTES = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/*';
export const TAILLE_MAX = 15 * 1024 * 1024;

// getIdToken ne change pas le compte : il rend le jeton en cours, renouvelé
// au besoin comme le SDK le fait de toute façon toutes les heures.
const entete = async () => ({ Authorization: `Bearer ${await auth.currentUser.getIdToken()}` });

async function erreurDe(reponse) {
  try { return new Error((await reponse.json()).erreur || `Erreur ${reponse.status}`); } catch { return new Error(`Erreur ${reponse.status}`); }
}

/** Envoie un fichier ; rend ce qu'on en garde dans Firestore : { id, nom, type, taille }. */
export async function envoyerFichier(coproId, fichier) {
  if (fichier.size > TAILLE_MAX) throw new Error('Fichier trop gros : 15 Mo au plus.');
  // Certains téléphones donnent un type vide aux photos HEIC : on le déduit du nom.
  const type = fichier.type || (/\.hei[cf]$/i.test(fichier.name) ? 'image/heic' : /\.pdf$/i.test(fichier.name) ? 'application/pdf' : '');
  let r;
  try {
    r = await fetch(`/api/fichiers/${coproId}`, {
      method: 'POST',
      body: fichier,
      headers: { ...(await entete()), 'Content-Type': type, 'X-Nom-Fichier': encodeURIComponent(fichier.name) },
    });
  } catch {
    throw new Error('Le NAS ne répond pas : le fichier n\'a pas été envoyé. Réessayez une fois en ligne.');
  }
  if (!r.ok) throw await erreurDe(r);
  const { id, nom, taille } = await r.json();
  return { id, nom, type, taille };
}

/** Ouvre un fichier dans un nouvel onglet. Le jeton ne peut pas voyager dans un simple lien : on télécharge, puis on montre. */
export async function ouvrirFichier(coproId, piece) {
  // L'onglet s'ouvre tout de suite, pendant le geste de l'utilisateur :
  // ouvert après le téléchargement, Safari le bloquerait comme fenêtre surgissante.
  const onglet = window.open('', '_blank');
  try {
    const r = await fetch(`/api/fichiers/${coproId}/${piece.id}`, { headers: await entete() });
    if (!r.ok) throw await erreurDe(r);
    const url = URL.createObjectURL(await r.blob());
    if (onglet) onglet.location.href = url; else window.location.href = url;
    // L'adresse locale du fichier ne sert plus après une minute.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    onglet?.close();
    throw e;
  }
}

export async function supprimerFichier(coproId, piece) {
  const r = await fetch(`/api/fichiers/${coproId}/${piece.id}`, { method: 'DELETE', headers: await entete() });
  if (!r.ok && r.status !== 404) throw await erreurDe(r);
}

export const taillelisible = (o) => (o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
