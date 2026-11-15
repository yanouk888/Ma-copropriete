// Essai des fonctions de courriel contre les émulateurs, avec des données
// inventées : le plafond d'invitations, les refus, et la boucle du résumé
// mensuel (que l'émulateur ne déclenche jamais seul : on l'appelle).
//
//   firebase emulators:exec --project demo-copro --only auth,firestore,functions "node essais/fonctions.mjs"
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ||= 'demo-copro';
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.ADRESSE_APP ||= 'https://exemple.ca';
process.env.EXPEDITEUR ||= 'Essai <essai@exemple.ca>';

// firebase-admin est installé dans functions/, pas à la racine : on le cherche
// là, pour que l'essai utilise exactement la version des fonctions.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const requis = createRequire(new URL('../functions/package.json', import.meta.url));
const charger = (m) => import(pathToFileURL(requis.resolve(m)).href);
const { initializeApp } = await charger('firebase-admin/app');
const { getFirestore } = await charger('firebase-admin/firestore');
const { getAuth } = await charger('firebase-admin/auth');
initializeApp({ projectId: 'demo-copro' });
const db = getFirestore();

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${nom}${cond ? '' : `  ${detail}`}`); };
const suffixe = Date.now();

// Un compte, sa copropriété, et un jeton pour appeler la fonction comme le ferait l'application.
async function compte(nom, coproId) {
  const u = await getAuth().createUser({ email: `${nom}-${suffixe}@exemple.ca`, password: 'essai-123456' });
  await db.collection('users').doc(u.uid).set(coproId ? { coproId } : {});
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=cle', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${nom}-${suffixe}@exemple.ca`, password: 'essai-123456', returnSecureToken: true }),
  });
  return { uid: u.uid, jeton: (await r.json()).idToken };
}
const appeler = async (jeton, courriel) => {
  const r = await fetch('http://127.0.0.1:5001/demo-copro/us-central1/inviterParCourriel', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    body: JSON.stringify({ data: { courriel } }),
  });
  return { statut: r.status, corps: await r.json() };
};

const coproId = `essai-${suffixe}`;
const membre = await compte('membre', coproId);
const etranger = await compte('etranger', coproId); // pointe vers la copro, sans en être membre
await db.collection('copros').doc(coproId).set({
  nom: 'Essai', code: 'COP-ESSAI234', gestionnaire: membre.uid, memberUids: [membre.uid],
  members: { [membre.uid]: { displayName: 'Membre', proportion: 100, frequencePaie: 'mensuel' } },
  logements: [{ id: 'l', nom: 'A', paliers: [{ depuis: '2026-01', montant: 1500 }] }],
  depenses: [{ id: 'd', nom: 'Condo', type: 'recurrente', frequence: 'mensuel', paliers: [{ depuis: '2026-01', montant: 2000 }] }],
  hypotheque: null, solde: { montant: 0, mois: '2026-01' }, ajustements: [],
});

let r = await appeler(null, 'a@exemple.ca');
ok('sans connexion : refusé', r.statut === 401, JSON.stringify(r));
r = await appeler(etranger.jeton, 'a@exemple.ca');
ok('non-membre : refusé', r.statut === 403, JSON.stringify(r));
r = await appeler(membre.jeton, 'pas-un-courriel');
ok('courriel invalide : refusé', r.statut === 400, JSON.stringify(r));
let acceptes = 0;
for (let i = 0; i < 10; i++) if ((await appeler(membre.jeton, `invite${i}@exemple.ca`)).statut === 200) acceptes++;
ok('dix invitations acceptées', acceptes === 10, `${acceptes}`);
r = await appeler(membre.jeton, 'onzieme@exemple.ca');
ok('la onzième est refusée (plafond quotidien)', r.statut === 429 && /10 invitations/.test(r.corps.error?.message), JSON.stringify(r));

// Résumé mensuel : on appelle la fonction planifiée directement.
const journal = [];
const log = console.log;
console.log = (...a) => { journal.push(a.join(' ')); };
const { resumeMensuel } = await import('../functions/src/resumeMensuel.js');
await resumeMensuel.run({});
console.log = log;
const pour = (nom) => journal.find((l) => l.includes(` à ${nom}-${suffixe}@exemple.ca`));
ok('résumé envoyé au membre', Boolean(pour('membre')), journal.slice(-3).join(' | '));
ok('pas de résumé à qui n\'est pas membre', !pour('etranger'));
await db.collection('users').doc(membre.uid).set({ courriels: { resume: false } }, { merge: true });
journal.length = 0;
console.log = (...a) => { journal.push(a.join(' ')); };
await resumeMensuel.run({});
console.log = log;
ok('résumé coupé : rien n\'est envoyé', !pour('membre'));

console.log(echecs ? `\n${echecs} échec(s)` : '\nLes fonctions de courriel se comportent comme prévu.');
process.exit(echecs ? 1 : 0);
