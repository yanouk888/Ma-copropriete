// Les mois sont des chaînes « AAAA-MM » partout dans l'application : elles se
// trient et se comparent telles quelles, et aucun fuseau horaire ne peut les
// faire glisser d'un jour — ce qu'un objet Date fait volontiers autour de
// minuit le premier du mois.

const NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const estMois = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function moisDe(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const indice = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

export function ajouterMois(m, n) {
  const i = indice(m) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Nombre de mois de `a` à `b` (positif si b est après a). */
export const ecartMois = (a, b) => indice(b) - indice(a);

export const suiteMois = (depart, n) => Array.from({ length: n }, (_, i) => ajouterMois(depart, i));

export function libelleMois(m, { court = false, annee = true } = {}) {
  const nom = (court ? COURTS : NOMS)[Number(m.slice(5, 7)) - 1];
  return annee ? `${nom} ${m.slice(0, 4)}` : nom;
}
