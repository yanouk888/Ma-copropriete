import { cloneElement, createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { ajouterMois, moisDe } from '../calc/mois';
import { lireMontant } from '../donnees/format';

// Les icônes sont dessinées ici plutôt que tirées d'une police hébergée
// ailleurs : aucun tiers ne voit passer les visiteurs, et rien à télécharger.
const TRACES = {
  apercu: 'M4 14a8 8 0 1 1 16 0M12 14l4-5M4 19h16',
  revenus: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6M9 10h.01M15 10h.01',
  depenses: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  planification: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  reglages: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  plus: 'M12 5v14M5 12h14',
  fermer: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  alerte: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  copier: 'M9 9h11v11H9zM5 15H4V4h11v1',
  crayon: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
};

export function Icone({ nom, taille = 22 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRACES[nom]} />
    </svg>
  );
}

/**
 * Fenêtre posée sur l'écran. Un vrai <dialog> ouvert par showModal() : le
 * navigateur se charge de retenir le focus dedans, de fermer sur Échap et de
 * rendre le reste de la page inerte — trois choses qu'une <div> imite mal.
 */
export function Feuille({ titre, onFermer, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d.open) d.showModal();
    const ouverte = performance.now();
    return () => {
      // La fenêtre repart au lieu de disparaître d'un coup. React la retire de
      // la page à l'instant où on la ferme : on laisse donc derrière elle une
      // copie inerte, le temps de l'animation de sortie. Pas de copie pour une
      // fenêtre à peine ouverte (le double montage de React en développement)
      // ni quand les animations sont réduites.
      const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduit && d.isConnected && performance.now() - ouverte > 250) {
        const fantome = d.cloneNode(true);
        fantome.classList.add('fantome');
        fantome.setAttribute('aria-hidden', 'true');
        fantome.inert = true;
        document.body.append(fantome);
        const retirer = () => fantome.remove();
        fantome.addEventListener('animationend', (e) => { if (e.target === fantome) retirer(); });
        // Filet : si l'animation ne se termine jamais, la copie ne reste pas.
        setTimeout(retirer, 600);
      }
      if (d.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="feuille"
      onClose={onFermer}
      // Un clic sur le fond (le <dialog> lui-même, hors de son contenu) ferme.
      onClick={(e) => { if (e.target === ref.current) onFermer(); }}
    >
      <header>
        <h2>{titre}</h2>
        <button type="button" className="icone-bouton" onClick={onFermer} aria-label="Fermer"><Icone nom="fermer" /></button>
      </header>
      {children}
    </dialog>
  );
}

/**
 * Un champ et son libellé. L'aide et l'erreur sont hors du <label> et reliées
 * par aria-describedby : dedans, elles feraient partie du nom du champ, et un
 * lecteur d'écran lirait « Nom, par exemple l'adresse de l'immeuble » à chaque
 * passage.
 */
export function Champ({ libelle, aide, erreur, children }) {
  const id = useId();
  const note = erreur || aide;
  return (
    <div className="champ">
      <label>
        <span>{libelle}</span>
        {note ? cloneElement(children, { 'aria-describedby': id, 'aria-invalid': erreur ? true : undefined }) : children}
      </label>
      {erreur ? <small id={id} className="erreur" role="alert">{erreur}</small> : aide ? <small id={id}>{aide}</small> : null}
    </div>
  );
}

/** Montant en dollars. Champ texte et non « number » : ce dernier refuse la virgule décimale sur bien des claviers. */
export function ChampMontant({ libelle, valeur, onChange, aide, erreur, ...reste }) {
  return (
    <Champ libelle={libelle} aide={aide} erreur={erreur}>
      <input type="text" inputMode="decimal" autoComplete="off" value={valeur}
        onChange={(e) => onChange(e.target.value)} placeholder="0" {...reste} />
    </Champ>
  );
}

/** Rend le montant tapé, ou null s'il n'est pas un nombre acceptable. */
export function montantValide(texte, { zeroPermis = false } = {}) {
  const n = lireMontant(texte);
  if (!Number.isFinite(n) || n < 0 || (!zeroPermis && n === 0)) return null;
  return Math.round(n * 100) / 100;
}

const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Choix d'un mois. Deux listes plutôt que <input type="month">, que Safari et
 * Firefox de bureau n'affichent pas : ils rendent un champ texte nu où il
 * faudrait deviner le format.
 */
export function ChampMois({ libelle, valeur, onChange, aide }) {
  const base = valeur || moisDe();
  const annee = Number(base.slice(0, 4));
  const courante = new Date().getFullYear();
  // Trois ans en arrière, dix en avant, et l'année déjà choisie quoi qu'il arrive.
  const annees = new Set([annee]);
  for (let a = courante - 3; a <= courante + 10; a++) annees.add(a);
  return (
    <div className="champ">
      <span>{libelle}</span>
      <div className="mois">
        <select aria-label={`${libelle} : mois`} value={base.slice(5, 7)} onChange={(e) => onChange(`${base.slice(0, 4)}-${e.target.value}`)}>
          {NOMS_MOIS.map((n, i) => <option key={n} value={String(i + 1).padStart(2, '0')}>{n}</option>)}
        </select>
        <select aria-label={`${libelle} : année`} value={annee} onChange={(e) => onChange(`${e.target.value}-${base.slice(5, 7)}`)}>
          {[...annees].sort().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {aide ? <small>{aide}</small> : null}
    </div>
  );
}

export function Segments({ options, valeur, onChange, libelle }) {
  return (
    <div className="segments" role="group" aria-label={libelle}>
      {options.map((o) => (
        <button key={o.valeur} type="button" aria-pressed={valeur === o.valeur} onClick={() => onChange(o.valeur)}>{o.libelle}</button>
      ))}
    </div>
  );
}

export function Bascule({ libelle, aide, coche, onChange, disabled }) {
  return (
    <label className="bascule">
      <span>{libelle}{aide ? <><br /><small className="discret">{aide}</small></> : null}</span>
      <input type="checkbox" role="switch" checked={coche} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Avis({ ton = 'info', children }) {
  return (
    <div className={`avis ${ton}`} role={ton === 'alerte' ? 'alert' : undefined}>
      <Icone nom={ton === 'info' ? 'info' : 'alerte'} taille={20} />
      <div>{children}</div>
    </div>
  );
}

export function Vide({ titre, texte, action }) {
  return (
    <div className="vide">
      <h3>{titre}</h3>
      <p>{texte}</p>
      {action}
    </div>
  );
}

// ───────── Messages brefs ─────────

const ContexteToast = createContext(() => {});
export const useToast = () => useContext(ContexteToast);

export function Toasts({ children }) {
  const [message, setMessage] = useState(null);
  const minuterie = useRef(null);
  const afficher = useCallback((texte) => {
    clearTimeout(minuterie.current);
    setMessage(texte);
    minuterie.current = setTimeout(() => setMessage(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(minuterie.current), []);
  return (
    <ContexteToast.Provider value={afficher}>
      {children}
      {message ? <div className="toast" role="status">{message}</div> : null}
    </ContexteToast.Provider>
  );
}

export { ajouterMois };
