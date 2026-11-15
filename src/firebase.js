import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
} from 'firebase/firestore';

// La configuration vient de variables d'environnement, jamais du code : on
// peut changer de projet Firebase ou de nom de domaine sans toucher au dépôt
// (docs/empreinte-numerique.md, règle 3). Voir .env.example.
const env = import.meta.env;
const emulateurs = env.VITE_EMULATEURS === '1';

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Sans configuration, initializeApp lève une erreur obscure au premier appel
// et la page reste blanche. On le dit plutôt à l'écran (App.jsx).
export const configure = Boolean(config.apiKey && config.projectId && config.appId);
export const cleVapid = env.VITE_FIREBASE_VAPID_KEY || '';

export const app = configure ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
// Les courriels de Firebase (mot de passe oublié, vérification d'adresse)
// partent dans cette langue, et la fenêtre Google s'affiche en français.
if (auth) auth.languageCode = 'fr';

// us-central1 : la région des fonctions (Firebase par défaut). Une autre ici
// et l'appel cherche une fonction qui n'existe pas.
export const fonctions = app ? getFunctions(app, 'us-central1') : null;

// Cache persistant (IndexedDB) : une saisie faite hors ligne survit à la
// fermeture de l'application, et la dernière lecture s'ouvre sans réseau. Le
// gestionnaire multi-onglets évite qu'un second onglet refuse de démarrer.
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;

if (app && emulateurs) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(fonctions, '127.0.0.1', 5001);
}

// Forcer le choix du compte : sinon Google reprend en silence le compte par
// défaut du téléphone, et qui en a deux se retrouve dans le mauvais.
export const fournisseurGoogle = new GoogleAuthProvider();
fournisseurGoogle.setCustomParameters({ prompt: 'select_account' });
