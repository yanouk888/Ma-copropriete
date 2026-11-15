import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dollars = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(n) || 0);

/**
 * Envoie une notification à un copropriétaire, sur tous ses appareils.
 *
 * `type` est la clé de ses préférences (Réglages → Notifications) : un type
 * qu'il a coupé n'est pas envoyé. Une erreur ici est consignée et avalée :
 * une notification ratée ne doit jamais faire échouer la fonction qui
 * l'envoie, sinon Firebase la relance et tous les autres la reçoivent en
 * double.
 */
export async function notifier(uid, { type, title, body }) {
  try {
    const db = getFirestore();
    const profil = (await db.collection('users').doc(uid).get()).data();
    if (!profil || profil.notifications?.[type] === false) return;
    const jetons = (profil.fcmTokens || []).filter(Boolean);
    if (!jetons.length) return;

    // Message « data-only », sans bloc `notification` : avec ce bloc, le
    // navigateur affiche la notification de lui-même EN PLUS de celle du
    // service worker, et on la reçoit deux fois.
    const reponse = await getMessaging().sendEachForMulticast({
      tokens: jetons,
      data: { type: String(type), title: String(title), body: String(body) },
      // Sans urgence « high », iOS et Android retiennent le message tant que
      // l'appareil dort.
      webpush: { headers: { Urgency: 'high' } },
    });

    // Un jeton refusé pour de bon (application désinstallée, permission
    // retirée) est effacé : le garder, c'est échouer à chaque envoi.
    const morts = reponse.responses
      .map((r, i) => (!r.success && /not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code || '') ? jetons[i] : null))
      .filter(Boolean);
    if (morts.length) {
      await db.collection('users').doc(uid).update({ fcmTokens: FieldValue.arrayRemove(...morts) });
    }
  } catch (erreur) {
    // Jamais le jeton dans les journaux : il permet d'écrire à l'appareil.
    console.error('[notifier] échec', type, erreur?.code || erreur?.message);
  }
}

/** Mois courant à Montréal, « AAAA-MM » : le serveur tourne en UTC et changerait de mois cinq heures trop tôt. */
export function moisCourant(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit' })
    .format(date).slice(0, 7);
}
