// Notifications poussées : demander la permission, obtenir le jeton de
// l'appareil et le ranger dans le profil, où les fonctions le trouveront.
import { arrayUnion, arrayRemove, doc, setDoc } from 'firebase/firestore';
import { app, db, cleVapid } from '../firebase';

// Ce que chacun peut couper, dans Réglages → Notifications. Les clés sont
// celles qu'envoient les fonctions (functions/src).
export const TYPES = [
  { cle: 'versement', libelle: 'Ma part mensuelle change' },
  { cle: 'autosuffisance', libelle: 'La copropriété devient autosuffisante' },
  { cle: 'planification', libelle: 'Le solde projeté passe sous zéro' },
  { cle: 'depenses', libelle: 'Nouvelle dépense ou nouveau logement' },
  { cle: 'hypotheque', libelle: 'Renouvellement de l\'hypothèque' },
  { cle: 'membres', libelle: 'Arrivée ou départ d\'un copropriétaire' },
];

const CLE_JETON = 'copro.jeton';

/** Pourquoi les notifications ne sont pas possibles ici, ou null si elles le sont. */
export function empechement() {
  if (!cleVapid) return 'Les notifications ne sont pas configurées sur ce site (clé VAPID absente).';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // Sur iPhone, c'est le cas dans Safari tant que le site n'est pas sur
    // l'écran d'accueil : Apple n'ouvre les notifications qu'aux applications
    // installées.
    return 'Ce navigateur ne permet pas les notifications. Sur iPhone, ajoutez d\'abord l\'application à l\'écran d\'accueil (Partager → Sur l\'écran d\'accueil), puis ouvrez-la de là.';
  }
  if (Notification.permission === 'denied') {
    return 'Les notifications sont bloquées pour ce site dans les réglages du navigateur.';
  }
  return null;
}

export const actives = () =>
  'Notification' in window && Notification.permission === 'granted' && Boolean(localStorage.getItem(CLE_JETON));

/** À appeler sur un geste de l'utilisateur : iOS refuse la demande de permission autrement. */
export async function activer(uid) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('La permission n\'a pas été accordée.');
  const enregistrement = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  // Importé ici et non en tête : le module de messagerie plante à l'import
  // dans les navigateurs sans notifications, et il alourdirait le démarrage
  // de tout le monde pour un réglage qu'on touche une fois.
  const { getMessaging, getToken } = await import('firebase/messaging');
  const jeton = await getToken(getMessaging(app), { vapidKey: cleVapid, serviceWorkerRegistration: enregistrement });
  if (!jeton) throw new Error('L\'appareil n\'a pas fourni de jeton de notification.');
  await setDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(jeton) }, { merge: true });
  localStorage.setItem(CLE_JETON, jeton);
}

export async function desactiver(uid) {
  const jeton = localStorage.getItem(CLE_JETON);
  localStorage.removeItem(CLE_JETON);
  if (!jeton) return;
  await setDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(jeton) }, { merge: true });
  try {
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    await deleteToken(getMessaging(app));
  } catch {
    // Le jeton est déjà retiré du profil : plus rien ne lui sera envoyé.
  }
}
