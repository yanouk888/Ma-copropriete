const entier = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });

/** Montant en dollars. Les cents ne paraissent que s'il y en a : « 1 500 $ », pas « 1 500,00 $ ». */
export const dollars = (n) => {
  const v = Number(n) || 0;
  return (Math.abs(v - Math.round(v)) < 0.005 ? entier : cents).format(v);
};

export const pourcent = (ratio) => `${Math.round(ratio * 100)} %`;

/** Lit un montant tapé à la québécoise : « 1 234,56 » comme « 1234.56 ». */
export const lireMontant = (texte) => {
  const n = Number(String(texte ?? '').replace(/[\s $]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
