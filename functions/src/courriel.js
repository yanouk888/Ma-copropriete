// Envoi de courriels par l'API de Resend.
//
// Trois réglages, aucun écrit dans le code (docs/empreinte-numerique.md) :
//  - RESEND_API_KEY : la clé, rangée dans Secret Manager — jamais dans un
//    fichier ni dans GitHub en clair ;
//  - ADRESSE_APP : l'adresse publique de l'application, pour les liens ;
//  - EXPEDITEUR : « Nom <adresse@domaine> », sur un domaine vérifié chez Resend.
// Les deux derniers viennent de functions/.env, que le workflow écrit à partir
// des variables du dépôt avant chaque déploiement.
import { defineSecret, defineString } from 'firebase-functions/params';

export const cleResend = defineSecret('RESEND_API_KEY');
export const adresseApp = defineString('ADRESSE_APP');
export const expediteur = defineString('EXPEDITEUR');

/**
 * Envoie un courriel. Lève une erreur si Resend refuse : à l'appelant de
 * décider si c'est grave (une invitation, oui ; un résumé parmi d'autres, non).
 *
 * Dans l'émulateur, sans clé, le courriel est écrit au journal au lieu d'être
 * envoyé : les essais passent par tout le chemin sans écrire à personne.
 */
export async function envoyerCourriel({ a, sujet, html, texte, repondreA }) {
  const cle = cleResend.value();
  if (!cle && process.env.FUNCTIONS_EMULATOR === 'true') {
    console.log(`[courriel simulé] de ${expediteur.value()} à ${a} — ${sujet}\n${texte}`);
    return { simule: true };
  }
  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: expediteur.value(),
      to: [a],
      subject: sujet,
      html,
      text: texte,
      ...(repondreA ? { reply_to: repondreA } : {}),
    }),
  });
  if (!reponse.ok) {
    // Le corps dit pourquoi (domaine non vérifié, clé invalide…) ; jamais la clé.
    throw new Error(`Resend a refusé l'envoi (${reponse.status}) : ${(await reponse.text()).slice(0, 300)}`);
  }
  return reponse.json();
}
