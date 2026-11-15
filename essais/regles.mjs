// Essai des règles Firestore contre l'émulateur : ce qu'un membre, un
// gestionnaire et un étranger peuvent et ne peuvent pas faire.
//
// Les règles sont le seul rempart entre les finances d'une copropriété et
// n'importe quel compte : elles s'essaient pour de vrai, pas à la lecture.
//
//   firebase emulators:exec --project demo-copro --only auth,firestore "node essais/regles.mjs"
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  writeBatch, arrayUnion, arrayRemove, deleteField, terminate,
} from 'firebase/firestore';

let echecs = 0;
const suffixe = Date.now();

async function compte(nom) {
  const app = initializeApp({ apiKey: 'cle-factice', projectId: 'demo-copro' }, nom);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await createUserWithEmailAndPassword(auth, `${nom}-${suffixe}@exemple.ca`, 'essai-123456');
  return { app, db, uid: user.uid };
}

async function attendu(nom, permis, geste) {
  let passe = true;
  let code = '';
  try { await geste(); } catch (e) { passe = false; code = e.code || e.message; }
  const bon = passe === permis;
  if (!bon) echecs++;
  console.log(`${bon ? 'OK   ' : 'ÉCHEC'} ${permis ? 'permis ' : 'refusé '} — ${nom}${bon ? '' : `  (obtenu : ${passe ? 'permis' : code})`}`);
}

const gest = await compte('gestionnaire');
const membre = await compte('membre');
const etranger = await compte('etranger');

const id = `copro-${suffixe}`;
const code = `COP-ESSAI${String(suffixe).slice(-3)}`;
const ref = (c) => doc(c.db, 'copros', id);
const fiche = (proportion, extra = {}) => ({ displayName: 'Essai', proportion, frequencePaie: 'mensuel', ...extra });
const copro = (uid) => ({
  nom: 'Essai', code, createdAt: new Date(), gestionnaire: uid, memberUids: [uid],
  members: { [uid]: fiche(100) }, logements: [], depenses: [], hypotheque: null, solde: null, ajustements: [],
});

// ─── Création ───
await attendu('créer une copropriété au nom d\'un autre', false, () =>
  setDoc(doc(etranger.db, 'copros', `${id}-x`), copro(gest.uid)));
await attendu('poser un code pour une copropriété qui n\'existe pas', false, () =>
  setDoc(doc(etranger.db, 'coproCodes', `${code}X`), { coproId: 'inexistante' }));
await attendu('créer sa copropriété et son code d\'un seul lot', true, () => {
  const lot = writeBatch(gest.db);
  lot.set(ref(gest), copro(gest.uid));
  lot.set(doc(gest.db, 'coproCodes', code), { coproId: id });
  return lot.commit();
});

// ─── Un étranger ne voit rien ───
await attendu('étranger : lire la copropriété par son identifiant', false, () => getDoc(ref(etranger)));
await attendu('étranger : lister toutes les copropriétés', false, () => getDocs(collection(etranger.db, 'copros')));
await attendu('étranger : lister les codes', false, () => getDocs(collection(etranger.db, 'coproCodes')));
await attendu('étranger : modifier le budget', false, () => updateDoc(ref(etranger), { solde: { montant: 1, mois: '2026-01' } }));
await attendu('étranger : lire le profil d\'un autre', false, () => getDoc(doc(etranger.db, 'users', gest.uid)));
await attendu('lire un code qu\'on connaît', true, () => getDoc(doc(etranger.db, 'coproCodes', code)));

// ─── Entrer ───
const entrer = (c, f) => updateDoc(ref(c), { memberUids: arrayUnion(c.uid), [`members.${c.uid}`]: f });
await attendu('entrer sans le code', false, () => entrer(etranger, fiche(0)));
await attendu('entrer avec un mauvais code', false, () => entrer(etranger, fiche(0, { codeUtilise: 'COP-AAAAAAAA' })));
await attendu('entrer en s\'attribuant 50 %', false, () => entrer(etranger, fiche(50, { codeUtilise: code })));
await attendu('entrer en se nommant gestionnaire', false, () =>
  updateDoc(ref(etranger), { memberUids: arrayUnion(etranger.uid), [`members.${etranger.uid}`]: fiche(0, { codeUtilise: code }), gestionnaire: etranger.uid }));
await attendu('entrer avec le bon code, à 0 %', true, () => entrer(membre, fiche(0, { codeUtilise: code })));

// ─── Un membre ───
await attendu('membre : lire la copropriété', true, () => getDoc(ref(membre)));
await attendu('membre : modifier le budget', true, () =>
  updateDoc(ref(membre), { depenses: [{ id: 'a', nom: 'Essai', type: 'ponctuelle', montant: 10, mois: '2026-01' }], modifiePar: membre.uid }));
await attendu('membre : changer sa fréquence de paie', true, () => updateDoc(ref(membre), { [`members.${membre.uid}.frequencePaie`]: 'hebdo' }));
await attendu('membre : changer sa propre proportion', false, () => updateDoc(ref(membre), { [`members.${membre.uid}.proportion`]: 90 }));
await attendu('membre : changer la fiche du gestionnaire', false, () => updateDoc(ref(membre), { [`members.${gest.uid}.displayName`]: 'Autre' }));
await attendu('membre : se nommer gestionnaire', false, () => updateDoc(ref(membre), { gestionnaire: membre.uid }));
await attendu('membre : retirer le gestionnaire', false, () =>
  updateDoc(ref(membre), { memberUids: arrayRemove(gest.uid), [`members.${gest.uid}`]: deleteField() }));
await attendu('membre : changer le code', false, () => updateDoc(ref(membre), { code: 'COP-BBBBBBBB' }));
await attendu('membre : supprimer la copropriété', false, () => deleteDoc(ref(membre)));
await attendu('membre : supprimer le code', false, () => deleteDoc(doc(membre.db, 'coproCodes', code)));

// ─── Les paiements confirmés ───
const paiement = (c, extra = {}) => setDoc(doc(c.db, 'copros', id, 'paiements', 'depense-a-2026-01'), {
  id: 'depense-a-2026-01', statut: 'paye', sens: 'sortie', montant: 437, mois: '2026-01', pieces: [], ...extra,
});
await attendu('membre : confirmer un paiement', true, () => paiement(membre));
await attendu('membre : lire les paiements', true, () => getDocs(collection(membre.db, 'copros', id, 'paiements')));
await attendu('étranger : lire les paiements', false, () => getDocs(collection(etranger.db, 'copros', id, 'paiements')));
await attendu('étranger : écrire un paiement', false, () => paiement(etranger));
await attendu('paiement au montant négatif', false, () => paiement(membre, { montant: -5 }));
await attendu('paiement au mois mal formé', false, () => paiement(membre, { mois: '2026-13' }));
await attendu('paiement dont l\'identifiant ne correspond pas', false, () => paiement(membre, { id: 'autre' }));

// ─── Le gestionnaire ───
await attendu('membre : se donner une part de propriété', false, () => updateDoc(ref(membre), { [`members.${membre.uid}.propriete`]: 90 }));
await attendu('gestionnaire : régler les parts de propriété', true, () =>
  updateDoc(ref(gest), { [`members.${gest.uid}.propriete`]: 50, [`members.${membre.uid}.propriete`]: 50 }));
await attendu('membre : retenir les intérêts du relevé du prêteur', true, () => updateDoc(ref(membre), { 'interetsDeclares.2026': 1200 }));
await attendu('gestionnaire : répartir les proportions', true, () =>
  updateDoc(ref(gest), { [`members.${gest.uid}.proportion`]: 60, [`members.${membre.uid}.proportion`]: 40 }));
await attendu('gestionnaire : céder la gestion à un étranger', false, () => updateDoc(ref(gest), { gestionnaire: etranger.uid }));
await attendu('gestionnaire : inscrire quelqu\'un d\'office', false, () =>
  updateDoc(ref(gest), { memberUids: arrayUnion(etranger.uid) }));
await attendu('gestionnaire : poser un code sans son document', false, () => updateDoc(ref(gest), { code: 'COP-CCCCCCCC' }));
const nouveauCode = `COP-NEUF${String(suffixe).slice(-4)}`;
await attendu('gestionnaire : changer le code d\'un seul lot', true, () => {
  const lot = writeBatch(gest.db);
  lot.delete(doc(gest.db, 'coproCodes', code));
  lot.set(doc(gest.db, 'coproCodes', nouveauCode), { coproId: id });
  lot.update(ref(gest), { code: nouveauCode });
  return lot.commit();
});
await attendu('entrer avec l\'ancien code', false, () => entrer(etranger, fiche(0, { codeUtilise: code })));
await attendu('gestionnaire : partir sans céder la gestion', false, () =>
  updateDoc(ref(gest), { memberUids: arrayRemove(gest.uid), [`members.${gest.uid}`]: deleteField() }));

// ─── Partir ───
await attendu('membre : partir en emmenant le gestionnaire', false, () =>
  updateDoc(ref(membre), { memberUids: [], members: {} }));
await attendu('membre : partir', true, () =>
  updateDoc(ref(membre), { memberUids: arrayRemove(membre.uid), [`members.${membre.uid}`]: deleteField() }));
await attendu('ancien membre : lire encore la copropriété', false, () => getDoc(ref(membre)));
await attendu('ancien membre : lire encore les paiements', false, () => getDocs(collection(membre.db, 'copros', id, 'paiements')));
await attendu('ancien membre : revenir sans le nouveau code', false, () => entrer(membre, fiche(0, { codeUtilise: code })));
await attendu('gestionnaire : supprimer la copropriété et son code', true, () => {
  const lot = writeBatch(gest.db);
  lot.delete(doc(gest.db, 'coproCodes', nouveauCode));
  lot.delete(ref(gest));
  return lot.commit();
});

for (const c of [gest, membre, etranger]) { await terminate(c.db); await deleteApp(c.app); }
console.log(echecs ? `\n${echecs} échec(s)` : '\nToutes les règles se comportent comme prévu.');
process.exit(echecs ? 1 : 0);
