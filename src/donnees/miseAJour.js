// La mise à jour de l'application, comme dans Budget Maison : automatique.
//
// Une application posée sur l'écran d'accueil n'est jamais fermée, seulement
// mise en arrière-plan : son document n'est jamais rechargé, et elle peut
// garder des semaines une version périmée. Le service worker (public/sw.js)
// ne sert pas l'application, il ne fait qu'afficher les notifications : le
// renouveler ne change rien à l'écran. Ce qui met à jour, c'est RECHARGER.
//
// On compare donc l'empreinte compilée dans ce bundle (la version qui tourne)
// à dist/version.json, servi sans cache (la version déployée), et l'on
// recharge quand c'est sûr :
//  - au démarrage, quand rien n'est encore saisi ;
//  - au retour au premier plan après plus d'une minute d'absence — en deçà,
//    on a peut-être un formulaire à moitié rempli ;
//  - toutes les heures, on regarde sans recharger : la version repérée sera
//    appliquée au prochain retour.
// Après le rechargement, une pastille dit ce qui s'est passé (AvisMiseAJour).

const BUILD = typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'dev';
const UNE_HEURE = 60 * 60 * 1000;
const SEUIL_REPRISE = 60 * 1000;
const CLE_ESSAI = 'maj-essayee';

let demarree = false;
let masqueDepuis = null;

async function rafraichirServiceWorker() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/');
    await reg?.update();
  } catch {
    // Hors ligne : on réessaiera au prochain retour au premier plan.
  }
}

/**
 * Rend vrai si une version plus récente est déployée ; recharge si demandé.
 * `forcer` (le bouton de Réglages) passe outre la limite d'un essai par version.
 */
export async function chercherMiseAJour({ recharger = false, forcer = false } = {}) {
  if (forcer) { try { sessionStorage.removeItem(CLE_ESSAI); } catch { /* rien */ } }
  if (BUILD === 'dev') return false;
  rafraichirServiceWorker();
  try {
    // no-store : relu depuis un cache, version.json dirait « à jour »
    // précisément quand on ne l'est pas.
    const r = await fetch('/version.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const { build } = await r.json();
    const nouvelle = typeof build === 'string' && build !== BUILD;
    if (nouvelle && recharger) {
      // Un seul essai par version annoncée et par session. Si, après le
      // rechargement, la page tourne encore sur l'ancien build (un cache
      // intermédiaire qui sert l'ancien index.html quelques instants), on ne
      // recharge pas en boucle : constaté à l'essai, 38 rechargements en
      // 2,5 secondes. On réessaiera au prochain retour au premier plan, dans
      // une autre session, ou par le bouton de Réglages.
      let deja = null;
      try { deja = sessionStorage.getItem(CLE_ESSAI); } catch { /* stockage bloqué */ }
      if (deja !== build) {
        try { sessionStorage.setItem(CLE_ESSAI, build); } catch { /* stockage bloqué : on recharge quand même une fois */ }
        window.location.reload();
      }
    }
    return nouvelle;
  } catch {
    // Pas de réseau : on ne sait rien, et surtout on ne prétend pas être à jour.
    return false;
  }
}

/** À appeler une fois, au démarrage (main.jsx). */
export function demarrerVeilleMiseAJour() {
  if (demarree || typeof document === 'undefined') return;
  demarree = true;
  chercherMiseAJour({ recharger: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { masqueDepuis = Date.now(); return; }
    const absence = masqueDepuis ? Date.now() - masqueDepuis : Infinity;
    masqueDepuis = null;
    chercherMiseAJour({ recharger: absence >= SEUIL_REPRISE });
  });
  setInterval(() => chercherMiseAJour({ recharger: false }), UNE_HEURE);
}
