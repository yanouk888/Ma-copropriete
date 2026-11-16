// La session : qui est connecté, à quelle copropriété, et tout ce qu'on peut
// y faire. Un seul contexte, parce que tout l'écran dépend des trois à la fois.
import { lectureSeule, venteDePart } from '../calc/proprietaires';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, sendPasswordResetEmail, sendEmailVerification, linkWithPopup, unlink,
} from 'firebase/auth';
import {
  doc, collection, onSnapshot, getDoc, getDocs, getDocFromServer, setDoc, query, where, limit, updateDoc, writeBatch,
  arrayUnion, arrayRemove, deleteField, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, fonctions, fournisseurGoogle } from '../firebase';
import { nouveauCode, normaliserCode, codeValide, nouvelId } from './code';
import { moisDe } from '../calc/mois';

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
  'auth/cancelled-popup-request': 'La fenêtre Google a été fermée avant la fin.',
  'auth/internal-error': 'La fenêtre Google n\'a pas pu s\'ouvrir. Vérifiez la connexion, puis réessayez.',
  'auth/popup-blocked': 'Le navigateur a bloqué la fenêtre Google. Autorisez les fenêtres pour ce site, puis réessayez.',
  'auth/credential-already-in-use': 'Ce compte Google sert déjà à un autre compte de l\'application. Connectez-vous avec lui, ou choisissez un autre compte Google.',
  'auth/provider-already-linked': 'Un compte Google est déjà lié à ce compte.',
  'auth/requires-recent-login': 'Par sécurité, déconnectez-vous puis reconnectez-vous avant de faire ce changement.',
  'auth/unauthorized-domain': 'Ce domaine n\'est pas autorisé dans Firebase (Authentication → Settings → Domaines autorisés).',
  'permission-denied': 'Accès refusé.',
  unavailable: 'Pas de réseau. Réessayez une fois reconnecté.',
};
export const messageErreur = (e) => {
  if (MESSAGES[e?.code]) return MESSAGES[e.code];
  // Les fonctions renvoient leurs refus déjà rédigés en français (« Pas plus
  // de 10 invitations par jour… ») ; seul « internal » ne dit rien d'utile.
  if (e?.code?.startsWith('functions/') && e.code !== 'functions/internal') return e.message;
  return e?.message && !e.code?.startsWith('functions/') ? e.message : 'Une erreur est survenue. Réessayez dans un moment.';
};

export function SessionProvider({ children, surErreur }) {
  // undefined = on ne sait pas encore ; null = personne.
  const [user, setUser] = useState(undefined);
  const [profil, setProfil] = useState(undefined);
  const [copro, setCopro] = useState(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) { setProfil(undefined); setCopro(undefined); nomSaisi.current = ''; }
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
  const nomSaisi = useRef('');
  const profilCourant = useRef(profil);
  profilCourant.current = profil;

  // Relance de l'écoute de la copropriété quand elle se trompe (voir plus bas).
  const [relance, setRelance] = useState(0);
  const essaisCopro = useRef(0);

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
    let recu = false;
    let refus = 0;
    const minuteries = [];
    const plusTard = (geste, delai) => minuteries.push(setTimeout(() => { if (actif) geste(); }, delai));
    const ref = doc(db, 'copros', coproId);
    const membre = (s) => s.exists() && (s.data().memberUids || []).includes(user.uid);
    const adopter = (s) => setCopro({ id: s.id, ...s.data() });

    // Le pointeur du profil ne vaut plus rien si on a été retiré ou si la
    // copropriété a été supprimée : on l'efface, et l'écran d'accueil revient.
    const oublier = () => {
      setCopro(null);
      setDoc(doc(db, 'users', user.uid), { coproId: null }, { merge: true }).catch(() => {});
    };

    // L'écoute est reprise de zéro, de plus en plus tard si elle se trompe encore.
    const relancer = () => {
      essaisCopro.current += 1;
      plusTard(() => setRelance((n) => n + 1), Math.min(30000, 500 * 2 ** essaisCopro.current));
    };

    // Le serveur fait foi, pas l'écoute. Juste après avoir créé une
    // copropriété ou y être entré avec un code, l'écoute locale peut dire
    // « absente », « pas membre », « refusé » — ou ne rien dire du tout —
    // alors que le serveur a bien le document et qu'on en est bien membre :
    // constaté dans l'émulateur, une fois sur cinq à dix, sans que la cause
    // dans le SDK soit établie. On se retrouvait à l'écran d'accueil pour de
    // bon. Donc, au moindre doute, on demande au serveur :
    //  - il confirme qu'on est membre : on affiche ce qu'il rend, et on
    //    reprend l'écoute de zéro ;
    //  - il dit le contraire deux fois de suite : alors seulement on oublie ;
    //  - il ne répond pas (hors ligne) : on ne conclut rien.
    const verifier = async () => {
      try {
        const s = await getDocFromServer(ref);
        if (!actif) return;
        if (membre(s)) { refus = 0; adopter(s); relancer(); return; }
        refus += 1;
      } catch (e) {
        if (!actif || e.code !== 'permission-denied') return;
        refus += 1;
      }
      if (refus >= 2) oublier(); else plusTard(verifier, 1500);
    };

    const arreter = onSnapshot(
      ref,
      (s) => {
        if (!membre(s)) { verifier(); return; }
        recu = true;
        essaisCopro.current = 0;
        adopter(s);
      },
      () => verifier()
    );
    // Une écoute qui n'a toujours rien rendu après deux secondes et demie est muette.
    plusTard(() => { if (!recu) verifier(); }, 2500);

    return () => { actif = false; minuteries.forEach(clearTimeout); arreter(); };
  }, [user, profil === undefined, coproId, relance]);

  // Toutes les copropriétés dont on est membre : un même compte peut détenir
  // un logement avec B et un autre avec C. Chacune reste un document à part,
  // pour que B ne voie jamais les chiffres de A avec C — les règles Firestore
  // protègent un document entier, pas une partie.
  //
  // La requête « memberUids contient moi » passe les règles par construction :
  // elle ne peut rendre que des copropriétés dont on est membre.
  const [mesCopros, setMesCopros] = useState([]);
  const mesCoprosRef = useRef(mesCopros);
  mesCoprosRef.current = mesCopros;
  useEffect(() => {
    if (!user) { setMesCopros([]); return undefined; }
    return onSnapshot(
      query(collection(db, 'copros'), where('memberUids', 'array-contains', user.uid)),
      (r) => setMesCopros(r.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
      // La liste ne sert qu'au sélecteur : une erreur ici ne doit rien bloquer.
      () => {}
    );
  }, [user]);

  // Les paiements confirmés de la copropriété ouverte : une sous-collection,
  // et non un champ du document — des années de factures dépasseraient le
  // mégaoctet qu'un document Firestore peut contenir.
  const [paiements, setPaiements] = useState([]);
  useEffect(() => {
    if (!copro?.id) { setPaiements([]); return undefined; }
    return onSnapshot(
      collection(db, 'copros', copro.id, 'paiements'),
      (r) => setPaiements(r.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => setPaiements([])
    );
  }, [copro?.id]);

  // Les copropriétés où l'on ne peut plus rien écrire (vendue, ou part
  // vendue). Les règles refuseraient déjà ; on le dit avant, en clair, au
  // lieu d'un « permission refusée » une seconde après.
  const verrouillees = useRef(new Set());
  useEffect(() => {
    const uid = user?.uid;
    verrouillees.current = new Set([...mesCopros, ...(copro ? [copro] : [])].filter((c) => lectureSeule(c, uid)).map((c) => c.id));
  }, [mesCopros, copro, user?.uid]);

  const actions = useMemo(() => {
    const bloquee = (id) => {
      if (!verrouillees.current.has(id)) return false;
      surErreur?.('Cette propriété est vendue : elle se consulte, elle ne se modifie plus.');
      return true;
    };
    const refProfil = () => doc(db, 'users', auth.currentUser.uid);
    const nomAffiche = () => nomSaisi.current || profilCourant.current?.nom || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Copropriétaire';
    const trace = () => ({ modifiePar: auth.currentUser.uid, modifieLe: serverTimestamp() });

    return {
      connexion: (courriel, motDePasse) => signInWithEmailAndPassword(auth, courriel, motDePasse),
      async inscription(nom, courriel, motDePasse) {
        // Le prénom est gardé en main avant même la création du compte : le
        // profil met un instant à revenir du serveur, et créer sa copropriété
        // dans cet intervalle l'aurait signée du début de l'adresse courriel.
        nomSaisi.current = nom;
        const { user: u } = await createUserWithEmailAndPassword(auth, courriel, motDePasse);
        // Le prénom va dans le profil Firestore, PAS dans le compte
        // (updateProfile). Modifier le compte fait émettre un nouveau jeton,
        // et Firestore relance alors toutes ses connexions : fait dans la
        // seconde qui suit l'inscription, cela laissait une fois sur cinq les
        // écoutes figées — l'écran d'accueil restait affiché à quelqu'un qui
        // venait de créer ou de rejoindre sa copropriété.
        await setDoc(doc(db, 'users', u.uid), { nom }, { merge: true });
        // Le lien de vérification part par Resend (réglage SMTP de Firebase,
        // deploy/README.md). Sans attendre et sans bloquer : une adresse non
        // vérifiée n'empêche rien, elle dit seulement qu'on n'est pas sûr
        // qu'elle soit bonne — ce qui compte pour « mot de passe oublié ».
        sendEmailVerification(u).catch(() => {});
      },
      renvoyerVerification: () => sendEmailVerification(auth.currentUser),

      /** Envoie le code d'invitation par courriel, par une fonction : la clé Resend reste au serveur. */
      async inviterParCourriel(coproId, courriel) {
        // La copropriété est nommée : avec plusieurs, celle du profil pourrait
        // avoir changé sur un autre appareil entre-temps.
        await httpsCallable(fonctions, 'inviterParCourriel')({ coproId, courriel });
      },
      google: () => signInWithPopup(auth, fournisseurGoogle),

      /**
       * Lie un compte Google au compte existant : ensuite, « Continuer avec
       * Google » ouvre le même compte, avec les mêmes copropriétés.
       *
       * La page se recharge aussitôt après. Lier un fournisseur change le
       * compte Firebase et lui fait émettre un nouveau jeton — exactement ce
       * qui figeait les écoutes de Firestore à la 1.1.0 (voir l'inscription
       * plus bas). Un rechargement repart d'un état sain, déjà connecté.
       */
      async lierGoogle() {
        await linkWithPopup(auth.currentUser, fournisseurGoogle);
        window.location.reload();
      },
      async dissocierGoogle() {
        await unlink(auth.currentUser, 'google.com');
        window.location.reload();
      },
      motDePasseOublie: (courriel) => sendPasswordResetEmail(auth, courriel),
      deconnexion: () => signOut(auth),

      /**
       * Enregistre un paiement confirmé (ou « non payé »). Son identifiant
       * est celui du paiement attendu : le confirmer deux fois réécrit le
       * même document au lieu d'en créer un second. Non attendu, comme
       * modifier() : hors ligne, la promesse ne se résout qu'au retour du réseau.
       */
      enregistrerPaiement(coproId, paiement) {
        if (bloquee(coproId)) return;
        setDoc(doc(db, 'copros', coproId, 'paiements', paiement.id), { ...paiement, ...trace() })
          .catch((e) => surErreur?.(messageErreur(e)));
      },
      supprimerPaiement(coproId, id) {
        if (bloquee(coproId)) return;
        deleteDoc(doc(db, 'copros', coproId, 'paiements', id)).catch((e) => surErreur?.(messageErreur(e)));
      },

      /** Passer à une autre de ses copropriétés. */
      choisir(id) {
        setDoc(refProfil(), { coproId: id }, { merge: true }).catch((e) => surErreur?.(messageErreur(e)));
      },

      /**
       * Crée la copropriété et son premier logement, sous le même nom : le nom
       * d'une copropriété est d'ordinaire l'adresse de l'immeuble, et la
       * redemander pour le logement faisait écrire deux fois la même chose.
       */
      async creerCopro(nom, loyer = 0) {
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
          logements: [{
            id: nouvelId(), nom, vacances: [], fin: null,
            paliers: [{ depuis: moisDe(), montant: Number(loyer) || 0 }],
          }],
          depenses: [],
          // Le suivi des paiements commence le mois de la création.
          suiviDepuis: moisDe(),
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
        // Déjà membre : on y va, simplement. Les règles refuseraient d'y
        // entrer une seconde fois, et le message parlerait d'un code périmé.
        if (mesCoprosRef.current.some((c) => c.id === id)) {
          await setDoc(refProfil(), { coproId: id }, { merge: true });
          return;
        }
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
        if (bloquee(id)) return;
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

      /** Inscrit la vente d'une part (src/calc/proprietaires.js). Réservé au gestionnaire. */
      async vendrePart(c, vendeur, acheteur, mois) {
        await updateDoc(doc(db, 'copros', c.id), { ...venteDePart(c, vendeur, acheteur, mois), ...trace() });
      },
      /** L'immeuble entier est vendu : il passe en lecture seule, gardé pour l'impôt. */
      async vendreCopro(c, mois) {
        await updateDoc(doc(db, 'copros', c.id), { vendue: { mois }, ...trace() });
      },
      async annulerVente(c) {
        await updateDoc(doc(db, 'copros', c.id), { vendue: deleteField(), ...trace() });
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
    user, profil, copro, actions, mesCopros, paiements,
    pret: user !== undefined && (user === null || (profil !== undefined && copro !== undefined)),
    estGestionnaire: Boolean(user && copro && copro.gestionnaire === user.uid),
    lectureSeule: Boolean(user && copro && lectureSeule(copro, user.uid)),
  }), [user, profil, copro, actions, mesCopros, paiements]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/** Raccourci pour les écrans du budget : la copropriété et de quoi la modifier. */
export function useCopro() {
  const { copro, actions } = useSession();
  const modifier = useCallback((changements) => actions.modifier(copro.id, changements), [actions, copro?.id]);
  return { copro, modifier };
}
