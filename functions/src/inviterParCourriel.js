// « Inviter par courriel » : envoie le code d'invitation de sa copropriété à
// une adresse. Appelée depuis Réglages → Inviter.
//
// Une fonction et non le navigateur, parce que la clé Resend ne doit jamais
// quitter le serveur. Et parce qu'une fonction peut vérifier, elle, que
// l'appelant est bien membre de la copropriété dont il envoie le code.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { cleResend, adresseApp, envoyerCourriel } from './courriel.js';
import { courrielInvitation } from './modeles.js';

// Dix par jour et par copropriété : de quoi inviter tout le monde, pas de quoi
// faire servir l'application à arroser des inconnus avec notre domaine — ce
// qui ruinerait sa réputation d'expéditeur, et nos courriels de compte avec.
const PLAFOND_QUOTIDIEN = 10;

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const inviterParCourriel = onCall({ secrets: [cleResend] }, async (requete) => {
  if (!requete.auth) throw new HttpsError('unauthenticated', 'Connectez-vous d\'abord.');
  const uid = requete.auth.uid;
  const a = String(requete.data?.courriel || '').trim().toLowerCase();
  if (!COURRIEL.test(a) || a.length > 200) throw new HttpsError('invalid-argument', 'Ce courriel n\'est pas valide.');

  const db = getFirestore();
  const profil = (await db.collection('users').doc(uid).get()).data();
  const coproId = profil?.coproId;
  if (!coproId) throw new HttpsError('failed-precondition', 'Vous n\'êtes dans aucune copropriété.');
  const copro = (await db.collection('copros').doc(coproId).get()).data();
  if (!copro || !(copro.memberUids || []).includes(uid)) {
    throw new HttpsError('permission-denied', 'Vous n\'êtes pas membre de cette copropriété.');
  }

  // Le compteur vit hors du document de la copropriété : les membres peuvent
  // écrire celui-là, ils pourraient remettre le compteur à zéro. Personne
  // n'écrit dans `limites` hormis les fonctions (aucune règle ne l'ouvre).
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
  const refLimite = db.collection('limites').doc(coproId);
  await db.runTransaction(async (t) => {
    const l = (await t.get(refLimite)).data();
    const deja = l?.jour === jour ? l.invitations || 0 : 0;
    if (deja >= PLAFOND_QUOTIDIEN) {
      throw new HttpsError('resource-exhausted', `Pas plus de ${PLAFOND_QUOTIDIEN} invitations par jour. Réessayez demain, ou donnez le code de vive voix.`);
    }
    t.set(refLimite, { jour, invitations: deja + 1, maj: FieldValue.serverTimestamp() });
  });

  const nomInviteur = copro.members?.[uid]?.displayName || 'Un copropriétaire';
  const message = courrielInvitation({ nomInviteur, nomCopro: copro.nom, code: copro.code, adresseApp: adresseApp.value() });
  try {
    // Une réponse arrive chez l'inviteur, pas dans une boîte que personne ne lit.
    await envoyerCourriel({ a, ...message, repondreA: requete.auth.token.email });
  } catch (erreur) {
    console.error('[invitation] échec', erreur.message);
    throw new HttpsError('unavailable', 'Le courriel n\'a pas pu partir. Réessayez dans un moment.');
  }
  return { envoye: true };
});
