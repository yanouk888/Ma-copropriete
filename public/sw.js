// Service worker de Mes copropriétés : il ne fait qu'une chose, afficher les
// notifications poussées.
//
// Il ne charge PAS le SDK Firebase, contrairement à celui de Budget Maison :
// le SDK s'importe depuis un CDN de Google (un tiers de plus qui voit passer
// chaque appareil, cf. docs/empreinte-numerique.md) et exige la configuration
// du projet écrite en dur dans ce fichier. Or un message FCM arrive de toute
// façon par l'événement « push » standard du navigateur, en JSON : on le lit
// directement.
//
// Il ne met rien en cache non plus (aucun gestionnaire « fetch ») : les
// données hors ligne sont l'affaire du cache persistant de Firestore, et un
// cache de fichiers mal purgé sert de vieilles versions pendant des semaines.

// Empreinte du build, substituée à la compilation (vite.config.js). Personne
// ne la lit : elle rend ce fichier différent d'un déploiement à l'autre, sans
// quoi le navigateur ne verrait jamais de nouveau service worker à installer.
const BUILD_STAMP = '__BUILD_STAMP__';

// La nouvelle version prend la main tout de suite : une application posée sur
// l'écran d'accueil n'est jamais vraiment fermée, elle attendrait toujours.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let donnees = {};
  try {
    // Les fonctions envoient des messages « data-only » : tout est sous `data`.
    const charge = event.data ? event.data.json() : {};
    donnees = charge.data || charge.notification || {};
  } catch {
    // Charge illisible : on affiche quand même quelque chose, car un « push »
    // sans notification visible fait révoquer la permission par le navigateur.
  }
  event.waitUntil(
    self.registration.showNotification(donnees.title || 'Mes copropriétés', {
      body: donnees.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      // Une seule notification par type : la plus récente remplace l'ancienne
      // au lieu d'empiler dix « loyer modifié ».
      tag: donnees.type || undefined,
    })
  );
});

// Toucher la notification ramène l'application si elle est ouverte, sinon l'ouvre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const client of liste) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow('/') : undefined;
    })
  );
});
