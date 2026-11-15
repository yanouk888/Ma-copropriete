// Le suivi des paiements réels et le rapport annuel pour l'impôt.
//
// Le budget dit ce qui DEVRAIT entrer et sortir ; le suivi dit ce qui est
// réellement entré et sorti, mois par mois, confirmé par un copropriétaire,
// avec la facture. Le rapport d'impôt ne se fie qu'au suivi : une facture de
// 437 $ prévue à 400 $ doit compter pour 437 $.
import { loyerDuMois, sortieReelle, deroulerHypotheque, mensualiteHypotheque } from './budget.js';
import { ajouterMois, ecartMois } from './mois.js';

// Au cent, et un demi-cent s'éloigne de zéro, comme on arrondit l'argent :
// Math.round seul ramènerait -212,085 à -212,08 et 212,085 à 212,09.
// L'epsilon rattrape les flottants comme 1,005 × 100 = 100,49999….
const arrondi = (n) => Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
const nombre = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/**
 * Les intitulés de dépenses de l'état des loyers (T776 au fédéral, TP-128 au
 * Québec), et la catégorie de l'application qui y mène.
 *
 * Pas de numéros de ligne, à dessein : ils n'ont pas pu être vérifiés à la
 * source, et ils changent d'un formulaire et d'une année à l'autre. Le
 * rapport donne un total par intitulé ; le contribuable ou son comptable le
 * reporte à la bonne ligne. Le classement reste indicatif — les frais de
 * copropriété, par exemple, se déclarent parfois autrement.
 */
export const RUBRIQUES = [
  { cle: 'publicite', libelle: 'Publicité', categories: ['Publicité'] },
  { cle: 'assurance', libelle: 'Assurance', categories: ['Assurances'] },
  { cle: 'interets', libelle: 'Intérêts et frais bancaires', categories: ['Frais bancaires'] },
  { cle: 'bureau', libelle: 'Frais de bureau', categories: ['Frais de bureau'] },
  { cle: 'honoraires', libelle: 'Frais comptables et juridiques', categories: ['Honoraires professionnels'] },
  { cle: 'gestion', libelle: 'Frais de gestion et d\'administration', categories: ['Gestion'] },
  { cle: 'entretien', libelle: 'Entretien et réparations', categories: ['Entretien', 'Travaux'] },
  { cle: 'salaires', libelle: 'Salaires et avantages', categories: ['Salaires'] },
  { cle: 'impots', libelle: 'Impôts fonciers (taxes municipales et scolaires)', categories: ['Taxes'] },
  { cle: 'deplacements', libelle: 'Frais de déplacement', categories: ['Déplacements'] },
  { cle: 'services', libelle: 'Services publics', categories: ['Énergie'] },
  { cle: 'autres', libelle: 'Autres dépenses', categories: ['Frais de condo', 'Services', 'Autre'] },
];
export const rubriqueDe = (categorie) =>
  RUBRIQUES.find((r) => r.categories.includes(categorie)) || RUBRIQUES.at(-1);

/** Le premier mois suivi : celui de la création de la copropriété, ou le réglage posé. */
export function debutSuivi(copro, moisCourant) {
  if (copro.suiviDepuis) return copro.suiviDepuis;
  const cree = copro.createdAt?.toDate?.() ?? (copro.createdAt?.seconds ? new Date(copro.createdAt.seconds * 1000) : null);
  if (!cree) return moisCourant;
  return `${cree.getFullYear()}-${String(cree.getMonth() + 1).padStart(2, '0')}`;
}

/** L'identifiant d'un paiement attendu : le même chaque fois, pour qu'une confirmation ne se crée qu'une fois. */
export const idAttendu = (type, id, mois) => `${type}-${id}-${mois}`;

/**
 * Ce que le budget attend pour un mois : chaque loyer à recevoir, chaque
 * dépense à payer, le paiement hypothécaire. Chacun avec son montant prévu.
 */
export function attendusDuMois(copro, mois, deroule = deroulerHypotheque(copro.hypotheque, mois)) {
  const liste = [];
  for (const l of copro.logements || []) {
    const montant = loyerDuMois(l, mois);
    if (montant > 0) {
      liste.push({ id: idAttendu('logement', l.id, mois), sens: 'entree', source: { type: 'logement', id: l.id }, mois, libelle: `Loyer — ${l.nom}`, prevu: arrondi(montant), categorie: 'Loyer' });
    }
  }
  for (const d of copro.depenses || []) {
    const montant = sortieReelle(d, mois);
    if (montant > 0) {
      liste.push({
        id: idAttendu('depense', d.id, mois), sens: 'sortie', source: { type: 'depense', id: d.id }, mois,
        libelle: d.nom, prevu: arrondi(montant), categorie: d.categorie || 'Autre',
        // Un achat en versements est souvent un bien durable (armoire) : on
        // le propose « en capital », que l'utilisateur corrige au besoin.
        nature: d.nature || (d.type === 'versements' ? 'capital' : 'courante'),
      });
    }
  }
  const h = copro.hypotheque;
  if (h && nombre(h.solde) > 0) {
    const ligne = deroule.get(mois);
    const paiement = ligne ? ligne.paiement : mois < h.dateSolde ? mensualiteHypotheque(h) : 0;
    if (paiement > 0) {
      liste.push({
        id: idAttendu('hypotheque', 'h', mois), sens: 'sortie', source: { type: 'hypotheque', id: 'h' }, mois,
        libelle: 'Paiement hypothécaire', prevu: arrondi(paiement), categorie: 'Hypothèque',
        interet: ligne ? ligne.interet : null, capital: ligne ? ligne.capital : null,
      });
    }
  }
  return liste;
}

/**
 * Les paiements attendus qui n'ont pas encore été confirmés (ni déclarés
 * « non payés »), du premier mois suivi jusqu'au mois courant compris, du
 * plus ancien au plus récent.
 */
export function aConfirmer(copro, paiements, moisCourant) {
  const faits = new Set(paiements.map((p) => p.id));
  const depart = debutSuivi(copro, moisCourant);
  const deroule = deroulerHypotheque(copro.hypotheque, moisCourant);
  const liste = [];
  // Borné à cinq ans : au-delà, un oubli n'est plus une confirmation à faire.
  const n = Math.min(60, ecartMois(depart, moisCourant) + 1);
  for (let i = Math.max(0, ecartMois(depart, moisCourant) + 1 - n); i <= ecartMois(depart, moisCourant); i++) {
    const mois = ajouterMois(depart, i);
    for (const a of attendusDuMois(copro, mois, deroule)) if (!faits.has(a.id)) liste.push(a);
  }
  return liste;
}

/** La part de propriété de chacun (pour l'impôt), en pour cent ; à défaut, sa proportion des versements. */
export function partsDePropriete(copro) {
  const parts = {};
  for (const [uid, m] of Object.entries(copro.members || {})) {
    parts[uid] = nombre(m.propriete ?? m.proportion);
  }
  return parts;
}

/**
 * Le rapport d'une année, à partir des seuls paiements confirmés.
 *
 *  - revenus : loyers et autres entrées reçus ;
 *  - dépenses courantes, par intitulé ;
 *  - intérêts hypothécaires : la part « intérêts » de chaque paiement
 *    confirmé, calculée — à remplacer par le relevé annuel du prêteur
 *    (copro.interetsDeclares[annee]) dès qu'on l'a ;
 *  - le capital remboursé et les dépenses en capital ne se déduisent pas :
 *    ils sont listés à part (le capital d'un bien s'amortit, DPA) ;
 *  - la part de chaque propriétaire selon sa part de propriété.
 */
export function rapportAnnuel(copro, paiements, annee) {
  const deLAnnee = paiements.filter((p) => p.statut === 'paye' && String(p.mois).startsWith(`${annee}-`));
  const revenus = arrondi(deLAnnee.filter((p) => p.sens === 'entree').reduce((s, p) => s + nombre(p.montant), 0));

  const parRubrique = Object.fromEntries(RUBRIQUES.map((r) => [r.cle, 0]));
  let interetsCalcules = 0;
  let capitalHypotheque = 0;
  let enCapital = 0;
  let tps = 0;
  let tvq = 0;
  for (const p of deLAnnee.filter((x) => x.sens === 'sortie')) {
    tps += nombre(p.tps);
    tvq += nombre(p.tvq);
    if (p.source?.type === 'hypotheque') {
      // La part d'intérêts du paiement réel : celle calculée pour ce mois,
      // jamais plus que ce qui a été payé.
      const interet = Math.min(nombre(p.montant), nombre(p.interet));
      interetsCalcules += interet;
      capitalHypotheque += nombre(p.montant) - interet;
    } else if (p.nature === 'capital') {
      enCapital += nombre(p.montant);
    } else {
      parRubrique[rubriqueDe(p.categorie).cle] += nombre(p.montant);
    }
  }
  const declares = copro.interetsDeclares?.[annee];
  const interetsHypotheque = arrondi(Number.isFinite(Number(declares)) && declares !== null && declares !== '' ? Number(declares) : interetsCalcules);
  // Les intérêts hypothécaires vont sous « Intérêts et frais bancaires ».
  parRubrique.interets += interetsHypotheque;
  const rubriques = RUBRIQUES.map((r) => ({ ...r, montant: arrondi(parRubrique[r.cle]) })).filter((r) => r.montant > 0);
  const depenses = arrondi(rubriques.reduce((s, r) => s + r.montant, 0));
  const net = arrondi(revenus - depenses);

  const parts = partsDePropriete(copro);
  const proprietaires = Object.entries(copro.members || {}).map(([uid, m]) => {
    const pct = parts[uid] / 100;
    return {
      uid, nom: m.displayName, pourcent: parts[uid],
      revenus: arrondi(revenus * pct), depenses: arrondi(depenses * pct), net: arrondi(net * pct),
    };
  });

  return {
    annee, revenus, rubriques, depenses, net,
    interetsHypotheque, interetsCalcules: arrondi(interetsCalcules), interetsDeclares: declares ?? null,
    capitalHypotheque: arrondi(capitalHypotheque), enCapital: arrondi(enCapital),
    tps: arrondi(tps), tvq: arrondi(tvq),
    proprietaires,
    totalParts: arrondi(Object.values(parts).reduce((s, x) => s + x, 0)),
    paiements: deLAnnee.sort((a, b) => (a.date || a.mois).localeCompare(b.date || b.mois)),
  };
}

/** Le détail de l'année en CSV (séparateur « ; », comme l'attend Excel en français). */
export function rapportCsv(rapport, nomCopro) {
  const champ = (v) => {
    const t = String(v ?? '');
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const montant = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toFixed(2).replace('.', ','));
  const lignes = [['Copropriété', 'Date', 'Mois', 'Sens', 'Libellé', 'Catégorie', 'Intitulé (état des loyers)', 'Nature', 'Montant', 'TPS', 'TVQ', 'Fournisseur', 'Pièces jointes', 'Note']];
  for (const p of rapport.paiements) {
    const intitule = p.sens === 'entree' ? 'Loyers bruts'
      : p.source?.type === 'hypotheque' ? 'Intérêts (part du paiement hypothécaire)'
      : p.nature === 'capital' ? '— (dépense en capital, à amortir)' : rubriqueDe(p.categorie).libelle;
    lignes.push([
      nomCopro, p.date || '', p.mois, p.sens === 'entree' ? 'Entrée' : 'Sortie', p.libelle, p.categorie, intitule,
      p.sens === 'entree' ? '' : p.nature === 'capital' ? 'Capital' : 'Courante',
      montant(p.montant), montant(p.tps), montant(p.tvq), p.fournisseur || '',
      (p.pieces || []).map((x) => x.nom).join(' | '), p.note || '',
    ]);
  }
  // Le BOM fait reconnaître l'UTF-8 à Excel : sans lui, « é » devient « Ã© ».
  return '﻿' + lignes.map((l) => l.map(champ).join(';')).join('\r\n') + '\r\n';
}
