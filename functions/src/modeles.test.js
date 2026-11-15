import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courrielInvitation, courrielResume as brut, echapper } from './modeles.js';

// Intl sépare les milliers et le « $ » par des espaces insécables : on les
// ramène à des espaces ordinaires pour que les attentes restent lisibles.
const net = (t) => t.replace(/[\u00a0\u202f]/g, ' ');
const courrielResume = (...a) => { const m = brut(...a); return m && { sujet: net(m.sujet), html: net(m.html), texte: net(m.texte) }; };

const copro = {
  nom: 'Rue <des> Érables',
  members: { a: { proportion: 60, frequencePaie: 'mensuel' }, b: { proportion: 40, frequencePaie: 'mensuel' } },
  memberUids: ['a', 'b'],
  logements: [{ paliers: [{ depuis: '2026-01', montant: 1500 }] }],
  depenses: [{ type: 'recurrente', frequence: 'mensuel', paliers: [{ depuis: '2026-01', montant: 2000 }] }],
  hypotheque: null,
  solde: { montant: 1000, mois: '2026-11' },
  ajustements: [],
};

test('invitation : le code, le lien qui le pré-remplit, et rien d\'injecté', () => {
  const m = courrielInvitation({ nomInviteur: 'Camille <b>', nomCopro: copro.nom, code: 'COP-ABCD2345', adresseApp: 'https://exemple.ca/' });
  assert.match(m.html, /COP-ABCD2345/);
  assert.match(m.html, /href="https:\/\/exemple\.ca\/\?code=COP-ABCD2345"/);
  assert.ok(!m.html.includes('<des>') && !m.html.includes('Camille <b>'), 'les noms saisis sont échappés');
  assert.match(m.texte, /https:\/\/exemple\.ca\/\?code=COP-ABCD2345/);
  assert.equal(m.sujet, 'Camille <b> vous invite dans « Rue <des> Érables »');
});

test('résumé : taux, part du membre, alerte de solde négatif', () => {
  const m = courrielResume({ copro, uid: 'b', mois: '2026-11', adresseApp: 'https://exemple.ca' });
  // 1500 / 2000 = 75 % ; il manque 500 $, dont 40 % = 200 $.
  assert.match(m.sujet, /75 %/);
  assert.match(m.texte, /Votre part : 200 \$ par mois/);
  assert.match(m.texte, /À verser par les copropriétaires : 500 \$/);
  assert.ok(!m.html.includes('<des>'));
});

test('résumé : autosuffisante, pas de « votre part »', () => {
  const riche = { ...copro, logements: [{ paliers: [{ depuis: '2026-01', montant: 2500 }] }] };
  const m = courrielResume({ copro: riche, uid: 'a', mois: '2026-11', adresseApp: 'https://exemple.ca' });
  assert.match(m.sujet, /se paie toute seule/);
  assert.ok(!m.texte.includes('Votre part'));
  assert.match(m.texte, /Surplus : 500 \$/);
});

test('résumé : rien à dire sans aucune sortie', () => {
  assert.equal(courrielResume({ copro: { ...copro, depenses: [] }, uid: 'a', mois: '2026-11', adresseApp: 'x' }), null);
});

test('échappement', () => {
  assert.equal(echapper('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});
