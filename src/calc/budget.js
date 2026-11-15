// Tous les calculs de l'application, sans rien de React ni de Firebase : des
// fonctions pures sur le document de la copropriété, pour pouvoir les essayer
// seules (npm test) — une erreur ici se lit en dollars à l'écran.

import { ajouterMois, ecartMois, suiteMois } from './mois.js';

// Combien de paiements par mois, en moyenne sur l'année. 52/12 et non 4 : un
// paiement hebdomadaire tombe cinq fois certains mois, et l'oublier
// sous-estime la dépense de 8 %.
export const FREQUENCES = {
  hebdo: { libelle: 'Chaque semaine', parMois: 52 / 12 },
  aux2semaines: { libelle: 'Aux 2 semaines', parMois: 26 / 12 },
  mensuel: { libelle: 'Chaque mois', parMois: 1 },
  trimestriel: { libelle: 'Aux 3 mois', parMois: 1 / 3 },
  annuel: { libelle: 'Une fois par an', parMois: 1 / 12 },
};

// Ce qu'un copropriétaire verse à chaque paie pour couvrir sa part mensuelle.
// Diviseurs repris de Budget Maison (÷ 4, ÷ 2, ÷ 1) : on verse un peu trop
// les mois à cinq paies, jamais trop peu.
export const PAIES = {
  hebdo: { libelle: 'Chaque semaine', diviseur: 4 },
  aux2semaines: { libelle: 'Aux 2 semaines', diviseur: 2 },
  mensuel: { libelle: 'Chaque mois', diviseur: 1 },
};

export const CATEGORIES = [
  'Frais de condo', 'Taxes', 'Assurances', 'Énergie', 'Entretien',
  'Gestion', 'Services', 'Travaux', 'Autre',
];

const arrondi = (n) => Math.round(n * 100) / 100;
const nombre = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

/**
 * Montant en vigueur un mois donné, parmi des paliers `{ depuis, montant }`.
 * C'est ce qui permet de modifier un loyer ou une dépense « à partir de mars »
 * sans réécrire le passé, et de planifier une hausse avant qu'elle n'arrive.
 * Rend null avant le premier palier : la chose n'existe pas encore.
 */
export function montantEnVigueur(paliers, mois) {
  let retenu = null;
  for (const p of paliers || []) {
    if (p.depuis <= mois && (!retenu || p.depuis >= retenu.depuis)) retenu = p;
  }
  return retenu ? nombre(retenu.montant) : null;
}

/**
 * Pose un nouveau montant à partir d'un mois : remplace le palier de ce mois
 * s'il existe, et efface ceux qui venaient après — un changement « à partir
 * de » vaut jusqu'à nouvel ordre, sinon une vieille hausse planifiée
 * reviendrait écraser la correction sans qu'on la voie.
 */
export function poserPalier(paliers, depuis, montant) {
  const gardes = (paliers || []).filter((p) => p.depuis < depuis);
  // Un palier identique au précédent n'apporte rien : on ne l'empile pas.
  const dernier = gardes.at(-1);
  if (dernier && nombre(dernier.montant) === nombre(montant)) return gardes;
  return [...gardes, { depuis, montant: nombre(montant) }];
}

// ───────── Revenus ─────────

/** Loyer encaissé pour un logement un mois donné (0 s'il est vacant ou fermé). */
export function loyerDuMois(logement, mois) {
  if (logement.fin && mois > logement.fin) return 0;
  if ((logement.vacances || []).includes(mois)) return 0;
  return montantEnVigueur(logement.paliers, mois) ?? 0;
}

export const revenusDuMois = (copro, mois) =>
  arrondi((copro.logements || []).reduce((s, l) => s + loyerDuMois(l, mois), 0));

// ───────── Dépenses ─────────

const recurrenteActive = (d, mois) =>
  montantEnVigueur(d.paliers, mois) !== null && !(d.fin && mois > d.fin);

/**
 * Ce qu'une dépense pèse dans le fonds de roulement un mois donné : sa part
 * « lissée », celle qu'il faut mettre de côté chaque mois pour que l'argent
 * soit là le jour du paiement.
 *
 * Une dépense ponctuelle ne pèse que si elle est amortie : un douzième par
 * mois pendant douze mois. Non amortie, elle se paie à même le solde du
 * compte et n'apparaît que dans la planification.
 */
// ───────── Achat en versements ─────────

// Fréquences permises pour un achat payé en plusieurs fois : un marchand
// propose des versements mensuels, parfois aux deux semaines, rarement plus.
export const FREQUENCES_VERSEMENTS = ['mensuel', 'aux2semaines', 'hebdo'];

/**
 * Combien de versements sont payés à la fin d'un mois donné, depuis le
 * premier. Pour des versements mensuels, un par mois. Aux deux semaines, 26
 * par an tombent inégalement dans les mois (deux, parfois trois) : on cumule
 * 26/12 par mois et on arrondit vers le bas, ce qui place le bon nombre de
 * versements dans l'année sans calendrier jour par jour.
 */
function versementsPayesA(d, mois) {
  const e = ecartMois(d.premier, mois);
  if (e < 0) return 0;
  const parMois = FREQUENCES[d.frequence]?.parMois ?? 1;
  // Le petit epsilon évite qu'un 2,1666…×12 calculé 25,9999 perde un versement.
  return Math.min(Math.max(0, Math.round(d.nombre)), Math.floor((e + 1) * parMois + 1e-9));
}

/** Les versements d'un achat qui tombent dans un mois donné. */
export const versementsDuMois = (d, mois) =>
  versementsPayesA(d, mois) - versementsPayesA(d, ajouterMois(mois, -1));

/** « 7 sur 36 » : le rang du dernier versement payé à la fin du mois, ou null hors de l'échéancier. */
export function rangVersement(d, mois) {
  const paye = versementsPayesA(d, mois);
  if (paye === 0) return null;
  if (paye >= d.nombre && versementsDuMois(d, mois) === 0) return null;
  return { rang: paye, sur: Math.round(d.nombre) };
}

export const montantDuVersement = (d) => (d.nombre > 0 ? nombre(d.montant) / Math.round(d.nombre) : 0);

/** Le mois du dernier versement. */
export function dernierVersement(d) {
  let m = d.premier;
  // Borné : 600 mois couvrent 50 ans de versements mensuels, bien au-delà de tout achat.
  for (let i = 0; i < 600 && versementsPayesA(d, m) < Math.round(d.nombre); i++) m = ajouterMois(m, 1);
  return m;
}

export function mensualiteDepense(d, mois) {
  // Un achat en versements pèse dans le fonds exactement ce qu'il coûte ce
  // mois-là : les versements sont déjà l'étalement, pas besoin de lisser.
  if (d.type === 'versements') return versementsDuMois(d, mois) * montantDuVersement(d);
  if (d.type === 'ponctuelle') {
    if (!d.amortie) return 0;
    const e = ecartMois(d.amortDebut, mois);
    return e >= 0 && e < 12 ? nombre(d.montant) / 12 : 0;
  }
  if (!recurrenteActive(d, mois)) return 0;
  return montantEnVigueur(d.paliers, mois) * (FREQUENCES[d.frequence]?.parMois ?? 1);
}

/**
 * Ce qui sort réellement du compte un mois donné. Diffère de la mensualité
 * pour ce qui se paie d'un coup : les taxes annuelles sortent en entier leur
 * mois, pas par douzièmes — et c'est ce creux que la planification doit
 * montrer.
 */
export function sortieReelle(d, mois) {
  if (d.type === 'versements') return versementsDuMois(d, mois) * montantDuVersement(d);
  if (d.type === 'ponctuelle') return d.mois === mois ? nombre(d.montant) : 0;
  if (!recurrenteActive(d, mois)) return 0;
  const montant = montantEnVigueur(d.paliers, mois);
  const periode = d.frequence === 'annuel' ? 12 : d.frequence === 'trimestriel' ? 3 : 0;
  if (!periode) return montant * (FREQUENCES[d.frequence]?.parMois ?? 1);
  const repere = d.moisRepere || d.paliers[0].depuis;
  // Modulo ramené en positif : le repère peut être après le mois regardé.
  const e = ((ecartMois(repere, mois) % periode) + periode) % periode;
  return e === 0 ? montant : 0;
}

// ───────── Hypothèque ─────────

/**
 * Taux mensuel d'une hypothèque canadienne à taux fixe : la loi veut que
 * l'intérêt soit composé semestriellement, pas mensuellement. Diviser le taux
 * annuel par 12 surestime l'intérêt.
 */
export const tauxMensuel = (tauxAnnuelPct) => Math.pow(1 + nombre(tauxAnnuelPct) / 200, 1 / 6) - 1;

export const mensualiteHypotheque = (h) =>
  h && nombre(h.solde) > 0 ? nombre(h.paiement) * (FREQUENCES[h.frequence]?.parMois ?? 1) : 0;

/**
 * Déroule l'hypothèque mois par mois depuis le mois où le solde a été saisi.
 * Rend, pour chaque mois, le paiement, sa part d'intérêt, sa part de capital
 * et le solde restant à la fin du mois.
 *
 * Approximation assumée : les paiements hebdomadaires ou aux deux semaines
 * sont ramenés à leur équivalent mensuel. L'écart avec le relevé du prêteur
 * est de quelques dollars par an ; ressaisir le solde le remet à zéro.
 */
export function deroulerHypotheque(h, jusquA) {
  const lignes = new Map();
  if (!h || !h.dateSolde) return lignes;
  let solde = nombre(h.solde);
  const i = tauxMensuel(h.taux);
  const mensualite = nombre(h.paiement) * (FREQUENCES[h.frequence]?.parMois ?? 1);
  for (let m = h.dateSolde; m <= jusquA; m = ajouterMois(m, 1)) {
    const interet = solde * i;
    // Le dernier paiement ne dépasse pas ce qui reste dû.
    const paiement = Math.min(mensualite, solde + interet);
    const capital = Math.max(0, paiement - interet);
    solde = Math.max(0, solde - capital);
    lignes.set(m, { paiement: arrondi(paiement), interet: arrondi(interet), capital: arrondi(capital), solde: arrondi(solde) });
  }
  return lignes;
}

/** Paiement hypothécaire d'un mois donné (0 avant la saisie ou une fois le prêt éteint). */
function paiementHypotheque(deroule, h, mois) {
  if (!h || !h.dateSolde) return 0;
  // Avant le mois de saisie, on suppose le même paiement : le prêt existait.
  if (mois < h.dateSolde) return mensualiteHypotheque(h);
  return deroule.get(mois)?.paiement ?? 0;
}

// ───────── Fonds de roulement et autosuffisance ─────────

/**
 * Le portrait d'un mois : ce qui entre, ce qu'il faut mettre de côté, et ce
 * qui manque pour que la copropriété se paie toute seule.
 *
 * L'autosuffisance compare les loyers à TOUTES les sorties, capital de
 * l'hypothèque compris : c'est ce qui sort réellement des poches. À 100 %,
 * plus personne ne verse rien.
 */
export function resumeDuMois(copro, mois, deroule = deroulerHypotheque(copro.hypotheque, mois)) {
  const revenus = revenusDuMois(copro, mois);
  const depenses = arrondi((copro.depenses || []).reduce((s, d) => s + mensualiteDepense(d, mois), 0));
  const hypotheque = arrondi(paiementHypotheque(deroule, copro.hypotheque, mois));
  const sorties = arrondi(depenses + hypotheque);
  const manque = arrondi(Math.max(0, sorties - revenus));
  return {
    mois,
    revenus,
    depenses,
    hypotheque,
    // Le fonds de roulement : ce qu'il faut pour un mois, tout compris.
    sorties,
    manque,
    surplus: arrondi(Math.max(0, revenus - sorties)),
    // null plutôt que l'infini quand il n'y a encore aucune sortie saisie.
    taux: sorties > 0 ? revenus / sorties : null,
    parts: partsDesMembres(copro, manque),
  };
}

/** Répartit un montant mensuel entre les copropriétaires selon leurs proportions. */
export function partsDesMembres(copro, montant) {
  const parts = {};
  for (const [uid, m] of Object.entries(copro.members || {})) {
    const mensuel = arrondi(montant * nombre(m.proportion) / 100);
    parts[uid] = { mensuel, parPaie: arrondi(mensuel / (PAIES[m.frequencePaie]?.diviseur ?? 1)) };
  }
  return parts;
}

export const totalProportions = (copro) =>
  Object.values(copro.members || {}).reduce((s, m) => s + nombre(m.proportion), 0);

// ───────── Planification ─────────

/**
 * Projette le solde du compte de la copropriété sur `n` mois à partir de
 * `depart`.
 *
 * Le solde saisi vaut « au début du mois `solde.mois` ». S'il date, le calcul
 * rejoue les mois écoulés avant d'arriver à `depart` : la projection reste
 * juste entre deux saisies, tant que rien d'imprévu n'est passé.
 *
 * Chaque mois : les loyers entrent, les copropriétaires versent ce qui manque
 * au fonds de roulement, les dépenses sortent à leur vraie date, et les
 * ajustements ponctuels s'ajoutent.
 */
export function planifier(copro, depart, n = 13) {
  const fin = ajouterMois(depart, n - 1);
  const deroule = deroulerHypotheque(copro.hypotheque, fin);
  const debut = copro.solde?.mois && copro.solde.mois < depart ? copro.solde.mois : depart;
  let solde = nombre(copro.solde?.montant);
  const lignes = [];
  for (const mois of suiteMois(debut, ecartMois(debut, fin) + 1)) {
    const resume = resumeDuMois(copro, mois, deroule);
    const depenses = arrondi((copro.depenses || []).reduce((s, d) => s + sortieReelle(d, mois), 0));
    const ajustements = (copro.ajustements || []).filter((a) => a.mois === mois);
    const totalAjustements = arrondi(ajustements.reduce((s, a) => s + nombre(a.montant), 0));
    const soldeDebut = solde;
    solde = arrondi(solde + resume.revenus + resume.manque - depenses - resume.hypotheque + totalAjustements);
    if (mois >= depart) {
      lignes.push({
        mois,
        soldeDebut,
        revenus: resume.revenus,
        versements: resume.manque,
        depenses,
        hypotheque: resume.hypotheque,
        ajustements,
        totalAjustements,
        soldeFin: solde,
        taux: resume.taux,
      });
    }
  }
  return lignes;
}

/** Premier mois où le solde projeté passe sous zéro, ou null. */
export const premierMoisNegatif = (lignes) => lignes.find((l) => l.soldeFin < 0)?.mois ?? null;
