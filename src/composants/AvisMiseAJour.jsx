import { useCallback, useEffect, useRef, useState } from 'react';

// La pastille « L'application a été mise à jour », reprise de Budget Maison.
//
// La mise à jour recharge l'application sans prévenir (donnees/miseAJour.js) :
// sans un mot, on croirait à un plantage. La pastille le dit, une fois par
// version et par appareil — jamais à la première ouverture, où il n'y a rien
// eu à mettre à jour. Elle descend du haut, reste quatre secondes, remonte ;
// un toucher ou un glissement vers le haut la renvoie plus tôt.
const CLE = 'version-vue';
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const VISIBLE_MS = 4000;
const GLISSEMENT_PX = 16;

function lireVue() {
  try { return localStorage.getItem(CLE); } catch { return null; }
}
function noterVue() {
  // Stockage bloqué (navigation privée) : la pastille ne paraîtra jamais, tant pis.
  try { localStorage.setItem(CLE, VERSION); } catch { /* rien */ }
}

export default function AvisMiseAJour() {
  // cachee → entre → sort → partie
  const [etat, setEtat] = useState('cachee');
  const depart = useRef(null);

  useEffect(() => {
    const vue = lireVue();
    noterVue();
    if (!vue || vue === VERSION || VERSION === '0.0.0') return undefined;
    // Un court délai : la page paraît d'abord, la pastille descend dessus.
    const t = setTimeout(() => setEtat((e) => (e === 'cachee' ? 'entre' : e)), 400);
    return () => clearTimeout(t);
  }, []);

  const fermer = useCallback(() => setEtat((e) => (e === 'entre' ? 'sort' : e)), []);
  useEffect(() => {
    if (etat !== 'entre') return undefined;
    const t = setTimeout(fermer, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [etat, fermer]);

  if (etat === 'cachee' || etat === 'partie') return null;
  return (
    <div className="avis-maj-cadre">
      <div
        role="status"
        className={`avis-maj ${etat === 'sort' ? 'sort' : 'entre'}`}
        onClick={fermer}
        onTouchStart={(e) => { depart.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const d = depart.current;
          depart.current = null;
          if (d !== null && e.changedTouches[0].clientY - d < -GLISSEMENT_PX) fermer();
        }}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget && etat === 'sort') setEtat('partie'); }}
      >
        <span className="avis-maj-icone" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <span>L’application a été mise à jour</span>
      </div>
    </div>
  );
}
