import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venteDePart, partsAuMois, lectureSeule, proprietairesActifs, nomProprietaire } from './proprietaires.js';

// Applique les chemins « members.x.y » d'updateDoc à un objet, pour l'essai.
function appliquer(copro, changements) {
  const c = structuredClone(copro);
  for (const [chemin, v] of Object.entries(changements)) {
    const morceaux = chemin.split('.');
    let o = c;
    for (const m of morceaux.slice(0, -1)) o = o[m];
    o[morceaux[morceaux.length - 1]] = v;
  }
  return c;
}

const base = {
  gestionnaire: 'a',
  members: {
    a: { displayName: 'Camille', proportion: 60, propriete: 50 },
    b: { displayName: 'Dominique', proportion: 40, propriete: 50 },
    c: { displayName: 'Alex', proportion: 0 },
  },
};

test('vente d\'une part : l\'acheteur reprend propriété et versements, le vendeur reste en lecture', () => {
  const apres = appliquer(base, venteDePart(base, 'a', 'c', '2027-06'));
  assert.equal(apres.members.c.propriete, 50);
  assert.equal(apres.members.c.proportion, 60);
  assert.equal(apres.members.a.propriete, 0);
  assert.equal(apres.members.a.venduLe, '2027-06');
  assert.equal(apres.gestionnaire, 'c', 'le gestionnaire qui vend passe la main');
  assert.ok(lectureSeule(apres, 'a'));
  assert.ok(!lectureSeule(apres, 'b'));
  assert.deepEqual(proprietairesActifs(apres).map((p) => p.uid), ['b', 'c']);
});

test('parts au mois : avant la vente, celles d\'avant ; ensuite, celles d\'aujourd\'hui', () => {
  const apres = appliquer(base, venteDePart(base, 'a', 'c', '2027-06'));
  assert.deepEqual(partsAuMois(apres, '2027-05'), { a: 50, b: 50, c: 0 });
  assert.deepEqual(partsAuMois(apres, '2027-06'), { a: 0, b: 50, c: 50 });
  // Après la vente, les parts se règlent encore : le dernier palier suit la fiche.
  const regle = { ...apres, members: { ...apres.members, b: { ...apres.members.b, propriete: 40 }, c: { ...apres.members.c, propriete: 60 } } };
  assert.equal(partsAuMois(regle, '2027-09').c, 60);
  assert.equal(partsAuMois(regle, '2027-05').a, 50);
});

test('deux ventes : chaque période garde ses parts, et le nom du vendeur reste', () => {
  const une = appliquer(base, venteDePart(base, 'a', 'c', '2027-06'));
  const deux = appliquer(une, venteDePart(une, 'b', 'c', '2028-01'));
  assert.deepEqual(partsAuMois(deux, '2027-03'), { a: 50, b: 50, c: 0 });
  assert.deepEqual(partsAuMois(deux, '2027-10'), { a: 0, b: 50, c: 50 });
  assert.deepEqual(partsAuMois(deux, '2028-02'), { a: 0, b: 0, c: 100 });
  const sansA = { ...deux, members: { b: deux.members.b, c: deux.members.c } };
  assert.equal(nomProprietaire(sansA, 'a'), 'Camille');
});

test('ventes refusées : à soi-même, deux fois, avant une vente déjà inscrite', () => {
  assert.throws(() => venteDePart(base, 'a', 'a', '2027-06'), /différentes/);
  const une = appliquer(base, venteDePart(base, 'a', 'c', '2027-06'));
  assert.throws(() => venteDePart(une, 'a', 'b', '2027-08'), /déjà vendu/);
  assert.throws(() => venteDePart(une, 'b', 'c', '2027-02'), /postérieure/);
  assert.throws(() => venteDePart(base, 'a', 'b', '2027-13'), /pas valide/);
});

test('rapport annuel : le vendeur ne déclare que ses mois', async () => {
  const { rapportAnnuel } = await import('./suivi.js');
  const copro = appliquer(base, venteDePart(base, 'a', 'c', '2027-07'));
  // 1 000 $ de loyer chaque mois de 2027, aucune dépense.
  const paiements = Array.from({ length: 12 }, (_, i) => ({
    id: `l-${i}`, statut: 'paye', sens: 'entree', montant: 1000, mois: `2027-${String(i + 1).padStart(2, '0')}`,
  }));
  const r = rapportAnnuel(copro, paiements, 2027);
  const de = (uid) => r.proprietaires.find((p) => p.uid === uid);
  assert.equal(de('a').revenus, 3000, 'Camille : 50 % de janvier à juin');
  assert.equal(de('c').revenus, 3000, 'Alex : 50 % de juillet à décembre');
  assert.equal(de('b').revenus, 6000);
  assert.ok(de('a').varie && !de('b').varie);
  assert.equal(de('a').pourcent, 25);
});
