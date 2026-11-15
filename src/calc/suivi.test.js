import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendusDuMois, aConfirmer, rapportAnnuel, rapportCsv, rubriqueDe, idAttendu, partsDePropriete } from './suivi.js';

const copro = {
  suiviDepuis: '2027-01',
  members: { a: { displayName: 'Camille', proportion: 60, propriete: 50 }, b: { displayName: 'Dominique', proportion: 40 } },
  logements: [{ id: 'l1', nom: 'App. 1', paliers: [{ depuis: '2026-01', montant: 1500 }] }],
  depenses: [
    { id: 'd1', nom: 'Taxes', categorie: 'Taxes', type: 'recurrente', frequence: 'annuel', moisRepere: '2027-03', paliers: [{ depuis: '2026-01', montant: 3600 }] },
    { id: 'd2', nom: 'Condo', categorie: 'Frais de condo', type: 'recurrente', frequence: 'mensuel', paliers: [{ depuis: '2026-01', montant: 400 }] },
    { id: 'd3', nom: 'Armoire', categorie: 'Travaux', type: 'versements', montant: 600, nombre: 6, frequence: 'mensuel', premier: '2027-01' },
  ],
  hypotheque: { solde: 300000, taux: 5, paiement: 1744.81, frequence: 'mensuel', dateSolde: '2027-01' },
};

test('attendus d\'un mois : loyer, dépenses à leur vraie date, hypothèque avec ses intérêts', () => {
  const janv = attendusDuMois(copro, '2027-01');
  assert.deepEqual(janv.map((a) => a.id), ['logement-l1-2027-01', 'depense-d2-2027-01', 'depense-d3-2027-01', 'hypotheque-h-2027-01']);
  assert.equal(janv.find((a) => a.source.id === 'd3').nature, 'capital');
  assert.equal(janv.find((a) => a.source.type === 'hypotheque').interet, 1237.17);
  assert.ok(attendusDuMois(copro, '2027-03').some((a) => a.id === 'depense-d1-2027-03' && a.prevu === 3600));
});

test('à confirmer : du premier mois suivi au mois courant, sans ce qui est déjà fait', () => {
  const tout = aConfirmer(copro, [], '2027-02');
  assert.equal(tout.length, 8);
  const reste = aConfirmer(copro, [{ id: 'logement-l1-2027-01' }, { id: idAttendu('hypotheque', 'h', '2027-01') }], '2027-02');
  assert.equal(reste.length, 6);
  assert.equal(reste[0].mois, '2027-01');
});

test('rubriques : chaque catégorie mène à un intitulé', () => {
  assert.equal(rubriqueDe('Taxes').cle, 'impots');
  assert.equal(rubriqueDe('Travaux').cle, 'entretien');
  assert.equal(rubriqueDe('Inconnue').cle, 'autres');
});

test('part de propriété : la sienne, sinon la proportion des versements', () => {
  assert.deepEqual(partsDePropriete(copro), { a: 50, b: 40 });
});

const paiements = [
  { id: 'p1', statut: 'paye', sens: 'entree', mois: '2027-01', montant: 1500, libelle: 'Loyer', categorie: 'Loyer', source: { type: 'logement' } },
  { id: 'p2', statut: 'paye', sens: 'sortie', mois: '2027-01', montant: 437, libelle: 'Condo', categorie: 'Frais de condo', nature: 'courante', tps: 0, tvq: 0, source: { type: 'depense' } },
  { id: 'p3', statut: 'paye', sens: 'sortie', mois: '2027-01', montant: 1744.81, interet: 1237.17, libelle: 'Hypothèque', categorie: 'Hypothèque', source: { type: 'hypotheque' } },
  { id: 'p4', statut: 'paye', sens: 'sortie', mois: '2027-01', montant: 100, libelle: 'Armoire', categorie: 'Travaux', nature: 'capital', source: { type: 'depense' } },
  { id: 'p5', statut: 'paye', sens: 'sortie', mois: '2027-02', montant: 250, libelle: 'Plombier; urgence', categorie: 'Entretien', nature: 'courante', tps: 10.87, tvq: 21.68, fournisseur: 'Plomberie "Exemple"', pieces: [{ nom: 'facture.pdf' }], source: { type: 'libre' } },
  { id: 'p6', statut: 'nonpaye', sens: 'sortie', mois: '2027-02', montant: 400, libelle: 'Condo', categorie: 'Frais de condo', source: { type: 'depense' } },
  { id: 'p7', statut: 'paye', sens: 'entree', mois: '2026-12', montant: 1500, libelle: 'Loyer', categorie: 'Loyer', source: { type: 'logement' } },
];

test('rapport : seuls les paiements confirmés de l\'année, intérêts à part du capital', () => {
  const r = rapportAnnuel(copro, paiements, 2027);
  assert.equal(r.revenus, 1500);
  assert.equal(r.interetsHypotheque, 1237.17);
  assert.equal(r.capitalHypotheque, 507.64);
  assert.equal(r.enCapital, 100);
  assert.deepEqual(r.rubriques.map((x) => [x.cle, x.montant]), [['interets', 1237.17], ['entretien', 250], ['autres', 437]]);
  assert.equal(r.depenses, 1924.17);
  assert.equal(r.net, -424.17);
  assert.equal(r.tps, 10.87);
  // Parts de propriété 50 / 40 : le rapport signale que le total ne fait pas 100.
  assert.equal(r.totalParts, 90);
  assert.equal(r.proprietaires.find((p) => p.uid === 'a').net, -212.09);
});

test('rapport : le relevé du prêteur remplace les intérêts calculés', () => {
  const r = rapportAnnuel({ ...copro, interetsDeclares: { 2027: 1200 } }, paiements, 2027);
  assert.equal(r.interetsHypotheque, 1200);
  assert.equal(r.interetsCalcules, 1237.17);
});

test('CSV : séparateur « ; », guillemets échappés, BOM pour Excel', () => {
  const csv = rapportCsv(rapportAnnuel(copro, paiements, 2027), 'Rue des Érables');
  assert.ok(csv.startsWith('﻿Copropriété;Date;'));
  assert.match(csv, /"Plombier; urgence"/);
  assert.match(csv, /"Plomberie ""Exemple"""/);
  assert.match(csv, /;250,00;10,87;21,68;/);
  assert.match(csv, /facture\.pdf/);
  assert.equal(csv.trim().split('\r\n').length, 6);
});
