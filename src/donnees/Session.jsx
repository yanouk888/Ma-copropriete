// La session : qui est connecté, à quelle copropriété, et tout ce qu'on peut
// y faire. Un seul contexte, parce que tout l'écran dépend des trois à la fois.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile, sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, collection, onSnapshot, getDoc, getDocs, getDocFromServer, setDoc, query, where, limit, updateDoc, writeBatch,
  arrayUnion, arrayRemove, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { auth, db, fournisseurGoogle } from '../firebase';
import { nouveauCode, normaliserCode, codeValide } from './code';

const Contexte = createContext(null);
export const useSession = () => useContext(Contexte);

// Les messages de Firebase sont en anglais et parlent de codes d'erreur.
const MESSAGES = {
  'auth/invalid-credential': 'Courriel ou mot de passe incorrect.',
  'auth/wrong-password': 'Courriel ou mot de passe incorrect.',
  'auth/user-not-found': 'Courriel ou mot de passe incorrect.',
  'auth/email-already-in-use': 'Un compte existe déjà avec ce courriel.',
  'auth/weak-password': 'Le mot de passe doit compter au moins 6 caractères.',
  'auth/invalid-email': 'Ce courriel n\'est pas valide.',
  'auth/too-many-requests': 'Trop d\'essais. Réessayez dans quelques minutes.',
  'auth/network-request-failed': 'Pas de réseau. Vérifiez la connexion.',
  'auth/popup-closed-by-user': 'La fenêtre Google a été fermée avant la fin.',
  'auth/unauthorized-domain': 'Ce domaine n\'est pas autorisé dans Firebase (Authentication → Settings → Domaines autorisés).',
  'permission-denied': 'Accès refusé.',
  unavailable: 'Pas de réseau. Réessayez une fois reconnecté.',
};
export const messageErreur = (e) => MESSAGES[e?.code] || e?.message || 'Une erreur est survenue.';

export function SessionProvider({ children, surErreur }) {
  // undefined = on ne sait pas encore ; null = personne.
  const [user, setUser] = useState(undefined);
  const [profil, setProfil] = useState(undefined);
  const [copro, setCopro] = useState(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) { setProfil(undefined); setCopro(undefined); }
  }), []);

  // Le profil dit à quelle copropriété on appartient.
  //
  // Une écoute refusée est relancée, jamais prise pour un profil vide. Juste
  // après la connexion, elle peut partir avant que Firestore ait reçu le jeton
  // du compte : le serveur la refuse, et une écoute refusée est morte pour de
  // bon. Prise pour « pas de profil », elle laissait l'écran d'accueil affiché
  // à quelqu'un qui venait de créer ou de rejoindre sa copropriété — une fois
  // sur quatre ou cinq, à froid.
  useEffect(() => {
    if (!user) return undefined;
    let arreter = () => {};
    let minuterie;
    let essais = 0;
    const ecouter = () => {
      arreter = onSnapshot(
        doc(db, 'users', user.uid),
        (s) => { essais = 0; setProfil(s.exists() ? s.data() : {}); },
        () => {
          // De plus en plus espacé, et sans fin : tant qu'on est connecté, le
          // profil finira par répondre, et rien d'autre ne peut s'afficher.
          essais += 1;
          minuterie = setTimeout(ecouter, Math.min(30000, 400 * 2 ** essais));
        }
      );
    };
    ecouter();
    return () => { clearTimeout(minuterie); arreter(); };
  }, [user]);

  const coproId = profil?.coproId || null;

  // Relance de l'écoute de la copropriété après un refus passager (voir plus bas).
  const [relance, setRelance] = useState(0);

  useEffect(() => {
    if (!user || profil === undefined) return undefined;
    if (!coproId) {
      setCopro(null);
      // Filet de sécurité : le profil ne pointe nulle part, mais on est
      // peut-être membre quand même — l'entrée se fait en deux écritures, et
      // la seconde (le pointeur) peut ne jamais partir si l'application est
      // fermée entre les deux. Sans ce rattrapage on serait coincé dehors :
      // les règles refusent d'entrer à qui est déjà membre.
      let courant = true;
      let minuterie;
      const chercher = (essai) => {
        getDocs(query(collection(db, 'copros'), where('memberUids', 'array-contains', user.uid), limit(1)))
          .then((r) => {
            if (courant && !r.empty) setDoc(doc(db, 'users', user.uid), { coproId: r.docs[0].id }, { merge: true });
          })
          // Refusé ou sans réseau : on réessaie trois fois, de plus en plus
          // tard. Un refus passager ne doit pas laisser dehors pour de bon.
          .catch(() => { if (courant && essai < 3) minuterie = setTimeout(() => chercher(essai + 1), 2000 * 2 ** essai); });
      };
      chercher(0);
      return () => { courant = false; clearTimeout(minuterie); };
    }
    let actif = true;
    const ref = doc(db, 'copros', coproId);

    // Le pointeur du profil ne vaut plus rien si on a été retiré ou si la
    // copropriété a été supprimée : on l'efface, et l'écran d'accueil revient.
    const oublier = () => {
      setCopro(null);
      setDoc(doc(db, 'users', user.uid), { coproId: null }, { merge: true }).catch(() => {});
    };

    // Avant d'oublier, on redemande au serveur. L'écoute peut dire « absent »
    // ou « refusé » à tort pendant un instant : juste après être entré avec un
    // code, le cache ne connaît de la copropriété que notre propre écriture,
    // et il arrivait une fois sur trois qu'on soit renvoyé à l'accueil alors
    // qu'on venait d'entrer. Seule une réponse franche du serveur fait foi ;
    // une panne de réseau, elle, ne prouve rien et ne fait rien oublier.
    const douter = async (ecouteMorte, confirme = false) => {
      try {
        const s = await getDocFromServer(ref);
        if (!actif) return;
        if (!s.exists() || !(s.data().memberUids || []).includes(user.uid)) { oublier(); return; }
        // On est bien membre : si l'écoute est tombée, on la relance (trois
        // fois au plus, pour ne pas tourner en rond sur une vraie panne).
        if (ecouteMorte && relance < 3) setRelance((n) => n + 1);
      } catch (e) {
        if (!actif || e.code !== 'permission-denied') return;
        // Un refus isolé peut venir du même contretemps de jeton que plus
        // haut : on ne conclut qu'au second, une seconde et demie plus tard.
        if (!confirme) setTimeout(() => { if (actif) douter(ecouteMorte, true); }, 1500);
        else oublier();
      }
    };

    const arreter = onSnapshot(
      ref,
      (s) => {
        if (!s.exists() || !(s.data().memberUids || []).includes(user.uid)) { douter(false); return; }
        setCopro({ id: s.id, ...s.data() });
      },
      (e) => { if (e.code === 'permission-denied') douter(true); }
    );
    return () => { actif = false; arreter(); };
  }, [user, profil === undefined, coproId, relance]);

  const actions = useMemo(() => {
    const refProfil = () => doc(db, 'users', auth.currentUser.uid);
    const nomAffiche = () => auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Copropriétaire';
    const trace = () => ({ modifiePar: auth.currentUser.uid, modifieLe: serverTimestamp() });

    return {
      connexion: (courriel, motDePasse) => signInWithEmailAndPassword(auth, courriel, motDePasse),
      async inscription(nom, courriel, motDePasse) {
        const { user: u } = await createUserWithEmailAndPassword(auth, courriel, motDePasse);
        await updateProfile(u, { displayName: nom });
      },
      google: () => signInWithPopup(auth, fournisseurGoogle),
      motDePasseOublie: (courriel) => sendPasswordResetEmail(auth, courriel),
      deconnexion: () => signOut(auth),

      async creerCopro(nom) {
        const uid = auth.currentUser.uid;
        const ref = doc(collection(db, 'copros'));
        const code = nouveauCode();
        const lot = writeBatch(db);
        lot.set(ref, {
          nom,
          code,
          createdAt: serverTimestamp(),
          gestionnaire: uid,
          memberUids: [uid],
          members: { [uid]: { displayName: nomAffiche(), proportion: 100, frequencePaie: 'mensuel' } },
          logements: [],
          depenses: [],
          hypotheque: null,
          solde: null,
          ajustements: [],
          ...trace(),
        });
        lot.set(doc(db, 'coproCodes', code), { coproId: ref.id });
        await lot.commit();
        // Le pointeur du profil s'écrit APRÈS, pas dans le lot : dès qu'il
        // paraît, l'écoute de la copropriété démarre, et si le serveur n'a pas
        // encore le document, il refuse la lecture (les règles ne trouvent
        // aucun membre à un document inexistant) — on se retrouvait renvoyé à
        // l'accueil une seconde après avoir créé.
        await setDoc(refProfil(), { coproId: ref.id }, { merge: true });
      },

      async rejoindre(saisie) {
        const code = normaliserCode(saisie);
        if (!codeValide(code)) throw new Error('Ce code n\'a pas la bonne forme : COP- suivi de 8 caractères.');
        const trouve = await getDoc(doc(db, 'coproCodes', code));
        if (!trouve.exists()) throw new Error('Aucune copropriété ne porte ce code.');
        const uid = auth.currentUser.uid;
        const id = trouve.data().coproId;
        // On écrit sans avoir lu la copropriété : les règles ne laissent pas
        // un non-membre la lire, et arrayUnion comme le chemin « members.uid »
        // s'en passent. Le code présenté est vérifié par les règles.
        await updateDoc(doc(db, 'copros', id), {
          memberUids: arrayUnion(uid),
          [`members.${uid}`]: { displayName: nomAffiche(), proportion: 0, frequencePaie: 'mensuel', codeUtilise: code },
          ...trace(),
        });
        await setDoc(refProfil(), { coproId: id }, { merge: true });
      },

      /**
       * Modifie le budget. Ne s'attend pas : hors ligne, la promesse de
       * Firestore ne se résout qu'au retour du réseau, alors que l'écriture
       * est déjà dans le cache et à l'écran. Attendre figerait la fenêtre.
       */
      modifier(id, changements) {
        updateDoc(doc(db, 'copros', id), { ...changements, ...trace() })
          .catch((e) => surErreur?.(messageErreur(e)));
      },

      majProfil(changements) {
        setDoc(refProfil(), changements, { merge: true }).catch((e) => surErreur?.(messageErreur(e)));
      },

      async quitter(c, successeur) {
        const uid = auth.currentUser.uid;
        await updateDoc(doc(db, 'copros', c.id), {
          memberUids: arrayRemove(uid),
          [`members.${uid}`]: deleteField(),
          ...(c.gestionnaire === uid ? { gestionnaire: successeur } : {}),
          ...trace(),
        });
        await setDoc(refProfil(), { coproId: null }, { merge: true });
      },

      async supprimerCopro(c) {
        const lot = writeBatch(db);
        lot.delete(doc(db, 'coproCodes', c.code));
        lot.delete(doc(db, 'copros', c.id));
        lot.set(refProfil(), { coproId: null }, { merge: true });
        await lot.commit();
      },

      /** Nouveau code : l'ancien cesse de fonctionner, pour fermer la porte après un départ. */
      async changerCode(c) {
        const code = nouveauCode();
        const lot = writeBatch(db);
        lot.delete(doc(db, 'coproCodes', c.code));
        lot.set(doc(db, 'coproCodes', code), { coproId: c.id });
        lot.update(doc(db, 'copros', c.id), { code, ...trace() });
        await lot.commit();
      },
    };
  }, [surErreur]);

  const valeur = useMemo(() => ({
    user, profil, copro, actions,
    pret: user !== undefined && (user === null || (profil !== undefined && copro !== undefined)),
    estGestionnaire: Boolean(user && copro && copro.gestionnaire === user.uid),
  }), [user, profil, copro, actions]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/** Raccourci pour les écrans du budget : la copropriété et de quoi la modifier. */
export function useCopro() {
  const { copro, actions } = useSession();
  const modifier = useCallback((changements) => actions.modifier(copro.id, changements), [actions, copro?.id]);
  return { copro, modifier };
}
