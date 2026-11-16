// Les propriétaires d'un immeuble et leurs parts dans le temps : ventes d'une
// part, vente de l'immeuble entier. Fonctions pures, partagées avec les
// Cloud Functions comme le reste de src/calc.
//
// Pourquoi un historique : l'impôt se déclare au prorata de la part détenue
// pendant l'année. Celui qui vend en juin déclare la moitié de l'année ;
// réécrire simplement sa part à 0 la lui ferait perdre tout entière.

const nombre = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** L'immeuble entier est vendu : il ne se modifie plus, il se consulte. */
export const estVendue = (copro) => Boolean(copro?.vendue);

/** Ce copropriétaire a vendu sa part : il garde l'accès, en lecture, pour son impôt. */
export const aVendu = (copro, uid) => Boolean(copro?.members?.[uid]?.venduLe);

/** Rien ne s'écrit : l'immeuble est vendu, ou on y a vendu sa part. */
export const lectureSeule = (copro, uid) => estVendue(copro) || aVendu(copro, uid);

/** Ceux qui détiennent encore une part, dans l'ordre de la fiche. */
export const proprietairesActifs = (copro) =>
  Object.entries(copro?.members || {}).filter(([, m]) => !m.venduLe).map(([uid, m]) => ({ uid, ...m }));

/** Ceux qui ont vendu leur part, avec le mois de la vente. */
export const anciensProprietaires = (copro) =>
  Object.entries(copro?.members || {}).filter(([, m]) => m.venduLe).map(([uid, m]) => ({ uid, ...m }));

/** Les parts de propriété d'aujourd'hui, en pour cent ; à défaut, la proportion des versements. */
function partsActuelles(copro) {
  const parts = {};
  for (const [uid, m] of Object.entries(copro?.members || {})) parts[uid] = nombre(m.propriete ?? m.proportion);
  return parts;
}

/**
 * Les parts de propriété d'un mois donné. L'historique est une suite de
 * paliers `{ depuis, parts, noms }` ; sans historique (aucune vente encore),
 * les parts d'aujourd'hui valent pour tous les mois.
 */
export function partsAuMois(copro, mois) {
  const paliers = copro?.historiqueParts || [];
  let retenu = null;
  for (const p of paliers) if (p.depuis <= mois) retenu = p;
  // Les parts d'après la dernière vente restent modifiables (Réglages →
  // Propriété) : le dernier palier cède donc la place aux parts actuelles.
  if (!retenu || retenu === paliers[paliers.length - 1]) return partsActuelles(copro);
  return { ...retenu.parts };
}

/** Le nom d'un propriétaire, même parti de la copropriété depuis : l'historique le garde. */
export function nomProprietaire(copro, uid) {
  const m = copro?.members?.[uid];
  if (m?.displayName) return m.displayName;
  for (const p of [...(copro?.historiqueParts || [])].reverse()) if (p.noms?.[uid]) return p.noms[uid];
  return 'Ancien propriétaire';
}

const noms = (copro) => Object.fromEntries(Object.entries(copro.members || {}).map(([uid, m]) => [uid, m.displayName || '']));

/**
 * Les changements qui font passer la part de `vendeur` à `acheteur` à partir
 * du mois `mois` (l'acheteur la détient dès ce mois-là). Le vendeur cède tout
 * — sa part de propriété comme sa proportion des versements — et reste
 * membre, en lecture, avec `venduLe`. Celui qui gérait passe la main à
 * l'acheteur : un vendeur ne gère plus rien.
 *
 * Renvoie un objet de chemins pour updateDoc.
 */
export function venteDePart(copro, vendeur, acheteur, mois) {
  const v = copro.members?.[vendeur];
  const a = copro.members?.[acheteur];
  if (!v || !a) throw new Error('Le vendeur et l\'acheteur doivent être copropriétaires.');
  if (vendeur === acheteur) throw new Error('Le vendeur et l\'acheteur doivent être deux personnes différentes.');
  if (v.venduLe) throw new Error(`${v.displayName} a déjà vendu sa part.`);
  if (a.venduLe) throw new Error(`${a.displayName} a vendu sa part : il ne peut pas en acheter une ici.`);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois || '')) throw new Error('Le mois de la vente n\'est pas valide.');
  const historique = copro.historiqueParts || [];
  const dernier = historique[historique.length - 1];
  if (dernier && mois < dernier.depuis) throw new Error('Une vente plus récente est déjà inscrite : la vente doit être postérieure.');

  const avant = partsActuelles(copro);
  const apres = { ...avant, [acheteur]: nombre(avant[acheteur]) + nombre(avant[vendeur]), [vendeur]: 0 };
  // Le premier palier fige les parts d'avant toute vente, depuis toujours.
  const paliers = historique.length ? historique.slice() : [{ depuis: '0000-01', parts: avant, noms: noms(copro) }];
  // Le palier en cours se fige aussi : jusqu'ici il suivait les parts actuelles.
  paliers[paliers.length - 1] = { ...paliers[paliers.length - 1], parts: avant, noms: noms(copro) };
  // Deux ventes le même mois : la seconde remplace le palier de la première.
  if (paliers[paliers.length - 1].depuis === mois) paliers.pop();
  paliers.push({ depuis: mois, parts: apres, noms: noms(copro) });

  const arrondi2 = (x) => Math.round(x * 100) / 100;
  return {
    historiqueParts: paliers,
    [`members.${acheteur}.propriete`]: arrondi2(apres[acheteur]),
    [`members.${acheteur}.proportion`]: arrondi2(nombre(a.proportion) + nombre(v.proportion)),
    [`members.${vendeur}.propriete`]: 0,
    [`members.${vendeur}.proportion`]: 0,
    [`members.${vendeur}.venduLe`]: mois,
    ...(copro.gestionnaire === vendeur ? { gestionnaire: acheteur } : {}),
  };
}
