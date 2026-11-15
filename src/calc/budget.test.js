import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montantEnVigueur, poserPalier, loyerDuMois, mensualiteDepense, sortieReelle,
  tauxMensuel, deroulerHypotheque, resumeDuMois, planifier, premierMoisNegatif,
} from './budget.js';
import { ajouterMois, ecartMois, suiteMois } from './mois.js';

const proche = (a, b, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('mois : addition à cheval sur une année', () => {
  assert.equal(ajouterMois('2026-11', 2), '2027-01');
  assert.equal(ajouterMois('2026-01', -1), '2025-12');
  assert.equal(ecartMois('2026-11', '2027-02'), 3);
  assert.deepEqual(suiteMois('2026-12', 3), ['2026-12', '2027-01', '2027-02']);
});

test('paliers : le montant suit la date', () => {
  const p = [{ depuis: '2026-01', montant: 1000 }, { depuis: '2026-07', montant: 1050 }];
  assert.equal(montantEnVigueur(p, '2025-12'), null);
  assert.equal(montantEnVigueur(p, '2026-06'), 1000);
  assert.equal(montantEnVigueur(p, '2026-07'), 1050);
});

test('paliers : une correction efface les hausses planifiées après elle', () => {
  const p = [{ depuis: '2026-01', montant: 1000 }, { depuis: '2026-07', montant: 1050 }];
  assert.deepEqual(poserPalier(p, '2026-03', 1020), [
    { depuis: '2026-01', montant: 1000 }, { depuis: '2026-03', montant: 1020 },
  ]);
  // Même montant que le palier précédent : rien à empiler.
  assert.deepEqual(poserPalier(p, '2026-03', 1000), [{ depuis: '2026-01', montant: 1000 }]);
});

test('loyer : vacance et fin de location', () => {
  const l = { paliers: [{ depuis: '2026-01', montant: 1200 }], vacances: ['2026-03'], fin: '2026-06' };
  assert.equal(loyerDuMois(l, '2026-02'), 1200);
  assert.equal(loyerDuMois(l, '2026-03'), 0);
  assert.equal(loyerDuMois(l, '2026-07'), 0);
});

test('dépense annuelle : lissée dans le fonds, payée d\'un coup dans le compte', () => {
  const taxes = { type: 'recurrente', frequence: 'annuel', moisRepere: '2026-03', paliers: [{ depuis: '2026-01', montant: 2400 }] };
  proche(mensualiteDepense(taxes, '2026-05'), 200);
  assert.equal(sortieReelle(taxes, '2026-05'), 0);
  assert.equal(sortieReelle(taxes, '2026-03'), 2400);
  assert.equal(sortieReelle(taxes, '2027-03'), 2400);
});

test('dépense ponctuelle : amortie sur douze mois exactement', () => {
  const toit = { type: 'ponctuelle', montant: 6000, mois: '2027-06', amortie: true, amortDebut: '2026-07' };
  const mois = suiteMois('2026-01', 30);
  proche(mois.reduce((s, m) => s + mensualiteDepense(toit, m), 0), 6000);
  assert.equal(mensualiteDepense(toit, '2026-06'), 0);
  proche(mensualiteDepense(toit, '2027-06'), 500);
  assert.equal(mensualiteDepense(toit, '2027-07'), 0);
  assert.equal(mois.reduce((s, m) => s + sortieReelle(toit, m), 0), 6000);
  // Non amortie : rien dans le fonds, tout dans le compte.
  assert.equal(mensualiteDepense({ ...toit, amortie: false }, '2027-01'), 0);
});

test('hypothèque : composition semestrielle canadienne', () => {
  // 6 % composé semestriellement = 6,09 % effectif par an.
  proche(Math.pow(1 + tauxMensuel(6), 12), 1.0609, 1e-9);
  // 300 000 $ à 5 % sur 25 ans : 1 744,81 $ par mois (table d'amortissement usuelle).
  const h = { solde: 300000, taux: 5, paiement: 1744.81, frequence: 'mensuel', dateSolde: '2026-01' };
  const d = deroulerHypotheque(h, ajouterMois('2026-01', 299));
  proche(d.get('2026-01').interet, 1237.17);
  assert.ok(d.get(ajouterMois('2026-01', 299)).solde < 5, 'le prêt s\'éteint au bout de 25 ans');
});

const copro = {
  members: {
    a: { proportion: 60, frequencePaie: 'aux2semaines' },
    b: { proportion: 40, frequencePaie: 'mensuel' },
  },
  logements: [
    { paliers: [{ depuis: '2026-01', montant: 1500 }] },
    { paliers: [{ depuis: '2026-01', montant: 1100 }, { depuis: '2026-07', montant: 1200 }] },
  ],
  depenses: [
    { type: 'recurrente', frequence: 'mensuel', paliers: [{ depuis: '2026-01', montant: 400 }] },
    { type: 'recurrente', frequence: 'annuel', moisRepere: '2026-03', paliers: [{ depuis: '2026-01', montant: 3600 }] },
  ],
  hypotheque: { solde: 300000, taux: 5, paiement: 1744.81, frequence: 'mensuel', dateSolde: '2026-01' },
  solde: { montant: 5000, mois: '2026-01' },
  ajustements: [{ mois: '2026-02', montant: -1000 }],
};

test('résumé : autosuffisance et parts de chacun', () => {
  const r = resumeDuMois(copro, '2026-02');
  assert.equal(r.revenus, 2600);
  proche(r.sorties, 400 + 300 + 1744.81);
  assert.equal(r.manque, 0);
  proche(r.surplus, 155.19);
  proche(r.taux, 2600 / 2444.81, 1e-6);
  // Sans le second logement, il manque de l'argent, réparti 60/40.
  const seul = resumeDuMois({ ...copro, logements: [copro.logements[0]] }, '2026-02');
  proche(seul.manque, 944.81);
  proche(seul.parts.a.mensuel, 566.89);
  proche(seul.parts.a.parPaie, 283.44, 0.011);
  proche(seul.parts.b.parPaie, 377.92);
});

test('planification : le solde suit les vraies sorties', () => {
  const p = planifier(copro, '2026-01', 13);
  assert.equal(p.length, 13);
  // Janvier : 5000 + 2600 − 400 − 1744,81.
  proche(p[0].soldeFin, 5455.19);
  // Février : l'ajustement de −1000.
  proche(p[1].soldeFin, 5455.19 + 2600 - 400 - 1744.81 - 1000);
  // Mars : les taxes annuelles sortent d'un coup.
  assert.equal(p[2].depenses, 4000);
  // Juillet : la hausse de loyer est là.
  assert.equal(p[6].revenus, 2700);
  assert.equal(premierMoisNegatif(p), null);
});

test('planification : un vieux solde est rejoué jusqu\'au mois de départ', () => {
  const tout = planifier(copro, '2026-01', 13);
  const plusTard = planifier(copro, '2026-04', 3);
  assert.equal(plusTard[0].mois, '2026-04');
  proche(plusTard[0].soldeDebut, tout[2].soldeFin);
});

test('planification : sans loyers, les versements comblent le fonds', () => {
  const vide = { ...copro, logements: [] };
  const p = planifier(vide, '2026-01', 13);
  proche(p[0].versements, 2444.81);
  // Les versements lissent les taxes : sur douze mois le solde revient au départ.
  proche(p[11].soldeFin, 5000 - 1000, 0.2);
});
