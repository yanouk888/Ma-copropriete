// Le premier du mois, 8 h à Montréal : un résumé par courriel à chaque
// copropriétaire qui ne l'a pas coupé (Réglages → Notifications).
//
// Un courriel et non une notification poussée : un résumé se relit, se
// garde, se transfère au comptable — une notification disparaît.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { cleResend, adresseApp, envoyerCourriel } from './courriel.js';
import { courrielResume } from './modeles.js';
import { moisCourant } from './envoyer.js';
import { estVendue, aVendu } from '../calc/proprietaires.js';

export const resumeMensuel = onSchedule(
  { schedule: '0 8 1 * *', timeZone: 'America/Toronto', secrets: [cleResend] },
  async () => {
    const db = getFirestore();
    const mois = moisCourant();
    const copros = await db.collection('copros').get();
    let envoyes = 0;
    let rates = 0;

    for (const doc of copros.docs) {
      const copro = doc.data();
      if (estVendue(copro)) continue;
      for (const uid of (copro.memberUids || []).filter((u) => !aVendu(copro, u))) {
        try {
          const profil = (await db.collection('users').doc(uid).get()).data();
          if (profil?.courriels?.resume === false) continue;
          // L'adresse vient du compte, pas d'un champ que le membre aurait pu
          // modifier : on n'écrit qu'à l'adresse avec laquelle il se connecte.
          const { email } = await getAuth().getUser(uid);
          if (!email) continue;
          const message = courrielResume({ copro, uid, mois, adresseApp: adresseApp.value() });
          if (!message) continue;
          await envoyerCourriel({ a: email, ...message });
          envoyes += 1;
        } catch (erreur) {
          // Un envoi raté n'empêche pas les autres : on le note et on continue.
          rates += 1;
          console.error('[résumé] échec pour un membre de', doc.id, erreur.message);
        }
      }
    }
    console.log(`[résumé] ${mois} : ${envoyes} envoyé(s), ${rates} raté(s)`);
  }
);
