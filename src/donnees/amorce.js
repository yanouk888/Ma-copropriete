// Le pont vers l'écran d'amorçage d'index.html : c'est l'application qui dit
// quand il peut partir — quand elle est utilisable (connexion, accueil ou
// copropriété affichés), pas quand React a seulement monté. Idempotent : le
// double montage de StrictMode en développement ne fait rien de plus.
export function signalerPrete() {
  window.__amorce?.pret();
}

/** Promesse résolue quand l'écran d'amorçage a disparu (tout de suite s'il n'y en a pas). */
export function apresAmorce() {
  if (!window.__amorce || window.__amorce.estRetiree()) return Promise.resolve();
  return new Promise((r) => window.addEventListener('amorce:retiree', r, { once: true }));
}
