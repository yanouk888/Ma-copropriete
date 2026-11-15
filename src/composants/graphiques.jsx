// Les graphiques de l'application, dessinés à la main en SVG et en CSS : pas
// de bibliothèque, donc rien à télécharger et rien qui dépende d'un tiers.
//
// Trois règles tenues partout :
//  - la couleur suit la chose, jamais son rang : l'hypothèque est toujours
//    bleue, qu'elle soit le plus gros poste ou le plus petit ;
//  - un texte ne porte jamais la couleur d'une série (le jaune est illisible
//    sur blanc) : c'est la pastille à côté qui dit de quoi on parle ;
//  - chaque graphique a sa légende ou son tableau : rien ne se lit à la
//    couleur seule.
import { useEffect, useRef, useState } from 'react';
import { dollars, pourcent } from '../donnees/format';
import { libelleMois } from '../calc/mois';
import { mensualiteDepense } from '../calc/budget';

const sansMouvement = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Un montant qui roule jusqu'à sa valeur, comme un odomètre, à l'ouverture
 * puis à chaque changement : l'œil voit que le chiffre a bougé, et dans quel
 * sens, au lieu de trouver un autre nombre à la place.
 */
export function Nombre({ valeur, format = dollars, className = '' }) {
  const [affiche, setAffiche] = useState(sansMouvement() ? valeur : 0);
  const depart = useRef(affiche);
  useEffect(() => {
    if (sansMouvement()) { setAffiche(valeur); depart.current = valeur; return undefined; }
    const de = depart.current;
    const debut = performance.now();
    let image;
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 700);
      // Départ vif, arrivée douce.
      const v = de + (valeur - de) * (1 - Math.pow(1 - p, 3));
      depart.current = v;
      setAffiche(p < 1 ? v : valeur);
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [valeur]);
  return <span className={`chiffre ${className}`}>{format(affiche)}</span>;
}

/** L'anneau d'autosuffisance : la part des sorties que les loyers couvrent. */
export function Jauge({ taux }) {
  const rayon = 62;
  const tour = 2 * Math.PI * rayon;
  // Au-delà de 100 %, l'anneau reste plein : le chiffre dit le reste.
  const part = Math.max(0, Math.min(1, taux ?? 0));
  return (
    <svg className="jauge-anneau" viewBox="0 0 160 160" role="img"
      aria-label={taux === null ? 'Autosuffisance : à déterminer' : `Autosuffisance : ${pourcent(taux)}`}>
      <circle className="piste" cx="80" cy="80" r={rayon} fill="none" strokeWidth="14" />
      <circle className="arc" cx="80" cy="80" r={rayon} fill="none" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={tour} strokeDashoffset={tour * (1 - part)} style={{ '--tour': tour }} transform="rotate(-90 80 80)" />
      <text x="80" y="84" textAnchor="middle" dominantBaseline="middle">
        {taux === null ? '—' : <Rouleau valeur={taux} />}
      </text>
    </svg>
  );
}

// Le pourcentage de l'anneau roule lui aussi ; un <tspan>, car on est dans du SVG.
function Rouleau({ valeur }) {
  const [v, setV] = useState(sansMouvement() ? valeur : 0);
  const de = useRef(v);
  useEffect(() => {
    if (sansMouvement()) { setV(valeur); return undefined; }
    const a = de.current; const debut = performance.now(); let image;
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / 900);
      const x = a + (valeur - a) * (1 - Math.pow(1 - p, 3));
      de.current = x; setV(p < 1 ? x : valeur);
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [valeur]);
  return <tspan>{pourcent(v)}</tspan>;
}

// ───────── Les postes de sortie ─────────

// Chaque poste a sa couleur pour de bon. L'ordre des teintes n'est pas
// décoratif : c'est celui que le validateur de palette a trouvé distinguable
// par un daltonien entre voisins. Sept teintes au plus ; les petites
// catégories se rangent sous « Autres », en gris, plutôt que d'en inventer une
// huitième qu'on confondrait avec une autre.
export const POSTES = {
  Hypothèque: { serie: 1, icone: 'M4 20V10l8-6 8 6v10zM10 20v-5h4v5' },
  'Frais de condo': { serie: 2, icone: 'M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3' },
  Taxes: { serie: 3, icone: 'M4 21h16M6 21V10M10 21V10M14 21V10M18 21V10M3 10h18L12 3z' },
  Assurances: { serie: 4, icone: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  Énergie: { serie: 5, icone: 'M13 2L5 13h6l-1 9 9-12h-6z' },
  Entretien: { serie: 6, icone: 'M14 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-2-2z' },
  Travaux: { serie: 7, icone: 'M3 21l9-9M14 4l6 6-3 3-6-6zM10 8l-5 1 4 4' },
  Autres: { serie: 0, icone: 'M5 12h.01M12 12h.01M19 12h.01' },
};
export const posteDe = (categorie) => (POSTES[categorie] ? categorie : 'Autres');
export const couleurSerie = (n) => (n ? `var(--serie-${n})` : 'var(--serie-autre)');

/** La tuile colorée qui précède une dépense dans une liste. */
export function TuilePoste({ poste }) {
  const p = POSTES[poste] || POSTES.Autres;
  return (
    <span className="tuile" style={{ '--teinte': couleurSerie(p.serie) }} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={p.icone} />
      </svg>
    </span>
  );
}

/** Ce que pèse chaque poste dans le fonds de roulement d'un mois, du plus fixe au plus divers. */
export function postesDuMois(copro, mois, hypotheque) {
  const totaux = {};
  for (const d of copro.depenses || []) {
    const m = mensualiteDepense(d, mois);
    if (m > 0) totaux[posteDe(d.categorie)] = (totaux[posteDe(d.categorie)] || 0) + m;
  }
  if (hypotheque > 0) totaux.Hypothèque = hypotheque;
  // L'ordre est celui des postes, pas celui des montants : un poste garde sa
  // place d'un mois à l'autre, on le retrouve sans chercher.
  return Object.keys(POSTES).filter((p) => totaux[p]).map((p) => ({ poste: p, montant: totaux[p], serie: POSTES[p].serie }));
}

/**
 * La barre des sorties : une part par poste, et sa légende chiffrée dessous —
 * qui sert aussi de tableau, pour qui ne distingue pas les couleurs. Toucher
 * une part ou une ligne met le poste en avant.
 */
export function Repartition({ postes }) {
  const [actif, setActif] = useState(null);
  const total = postes.reduce((s, p) => s + p.montant, 0);
  if (!total) return null;
  return (
    <div className="repartition" onPointerLeave={() => setActif(null)}>
      <div className="barre-parts" role="img" aria-label="Répartition des sorties du mois, détaillée dans la liste qui suit">
        {postes.map((p) => (
          <span key={p.poste} className={actif && actif !== p.poste ? 'efface' : ''}
            style={{ flexGrow: p.montant, background: couleurSerie(p.serie) }}
            onPointerEnter={() => setActif(p.poste)} onClick={() => setActif(actif === p.poste ? null : p.poste)} />
        ))}
      </div>
      <ul className="legende">
        {postes.map((p) => (
          <li key={p.poste} className={actif && actif !== p.poste ? 'efface' : ''}
            onPointerEnter={() => setActif(p.poste)} onClick={() => setActif(actif === p.poste ? null : p.poste)}>
            <span className="pastille-serie" style={{ background: couleurSerie(p.serie) }} />
            <span className="nom">{p.poste}</span>
            <span className="discret chiffre">{pourcent(p.montant / total)}</span>
            <span className="chiffre">{dollars(p.montant)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Deux barres sur la même échelle : ce qui entre, ce qui sort. La plus courte dit tout. */
export function EntreesSorties({ entrees, sorties, nomEntrees = 'Loyers' }) {
  const max = Math.max(entrees, sorties, 1);
  return (
    <div className="duel">
      {[[nomEntrees, entrees, 'entree'], ['Sorties', sorties, 'sortie']].map(([nom, v, classe]) => (
        <div className="rang" key={nom}>
          <span className="nom">{nom}</span>
          <span className="voie"><span className={`trait ${classe}`} style={{ width: `${(v / max) * 100}%` }} /></span>
          <Nombre valeur={v} />
        </div>
      ))}
    </div>
  );
}

/**
 * Le taux d'autosuffisance mois par mois, face à la ligne des 100 %.
 * Glisser le doigt ou la souris sur la courbe lit un mois ; au repos, on lit
 * le dernier.
 */
export function Trajectoire({ plan }) {
  const points = plan.filter((l) => l.taux !== null);
  const [vise, setVise] = useState(null);
  if (points.length < 2) return null;
  const L = 320; const H = 150; const g = 34; const d = 12; const h = 12; const b = 24;
  const valeurs = points.map((p) => p.taux);
  // L'échelle englobe toujours les 100 % : c'est la cible, elle doit se voir.
  const bas = Math.max(0, Math.floor((Math.min(...valeurs, 1) - 0.08) * 10) / 10);
  const haut = Math.ceil((Math.max(...valeurs, 1) + 0.04) * 10) / 10;
  const x = (i) => g + (i / (points.length - 1)) * (L - g - d);
  const y = (v) => h + (1 - (v - bas) / (haut - bas)) * (H - h - b);
  const trace = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.taux).toFixed(1)}`).join(' ');
  const i = vise ?? points.length - 1;
  const lu = points[i];

  const viser = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    setVise(Math.max(0, Math.min(points.length - 1, Math.round(((px - g) / (L - g - d)) * (points.length - 1)))));
  };

  return (
    <figure className="trajectoire">
      <figcaption>
        <span className="discret">{libelleMois(lu.mois)}</span>
        <strong className="chiffre">{pourcent(lu.taux)}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Taux d'autosuffisance de ${libelleMois(points[0].mois)} à ${libelleMois(points.at(-1).mois)} : de ${pourcent(points[0].taux)} à ${pourcent(points.at(-1).taux)}`}
        onPointerMove={viser} onPointerDown={viser} onPointerLeave={() => setVise(null)}>
        {[bas, 1, haut].filter((v, k, t) => t.indexOf(v) === k).map((v) => (
          <g key={v}>
            <line className={v === 1 ? 'cible' : 'grille'} x1={g} x2={L - d} y1={y(v)} y2={y(v)} />
            <text className="axe" x={g - 6} y={y(v)} textAnchor="end" dominantBaseline="middle">{pourcent(v)}</text>
          </g>
        ))}
        <path className="aire" d={`${trace} L${x(points.length - 1)} ${y(bas)} L${x(0)} ${y(bas)} Z`} />
        <path className="courbe" d={trace} pathLength="1" />
        <text className="axe" x={g} y={H - 6}>{libelleMois(points[0].mois, { court: true })}</text>
        <text className="axe" x={L - d} y={H - 6} textAnchor="end">{libelleMois(points.at(-1).mois, { court: true })}</text>
        {vise !== null ? <line className="viseur" x1={x(i)} x2={x(i)} y1={h} y2={H - b} /> : null}
        <circle className="point" cx={x(i)} cy={y(lu.taux)} r="5" />
      </svg>
    </figure>
  );
}

/** Treize mois d'un logement d'un coup d'œil : loué, vacant, ou pas encore loué. */
export function Occupation({ etats }) {
  return (
    <span className="occupation" role="img"
      aria-label={`Sur ${etats.length} mois : ${etats.filter((e) => e.etat === 'loue').length} loués, ${etats.filter((e) => e.etat === 'vacant').length} vacants`}>
      {etats.map((e) => <span key={e.mois} className={e.etat} title={`${libelleMois(e.mois)} : ${e.etat === 'loue' ? 'loué' : e.etat === 'vacant' ? 'vacant' : 'non loué'}`} />)}
    </span>
  );
}

/** Le rond aux initiales d'un copropriétaire, à sa couleur. */
export function Avatar({ nom, serie }) {
  return <span className="avatar" style={{ '--teinte': couleurSerie(serie) }} aria-hidden="true">{(nom || '?').trim().charAt(0).toUpperCase()}</span>;
}
