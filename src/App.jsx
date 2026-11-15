import { useEffect, useState } from 'react';
import { configure } from './firebase';
import { SessionProvider, useSession } from './donnees/Session';
import { Icone, Toasts, useToast } from './composants/ui';
import Connexion from './pages/Connexion';
import Logo from './composants/Logo';
import { PastilleCopro } from './composants/MesCopros';
import Bienvenue from './pages/Bienvenue';
import Apercu from './onglets/Apercu';
import Revenus from './onglets/Revenus';
import Depenses from './onglets/Depenses';
import Planification from './onglets/Planification';
import Suivi from './onglets/Suivi';
import Reglages from './onglets/Reglages';

const ONGLETS = [
  { cle: 'apercu', nom: 'Aperçu', Ecran: Apercu },
  { cle: 'revenus', nom: 'Revenus', Ecran: Revenus },
  { cle: 'depenses', nom: 'Dépenses', Ecran: Depenses },
  { cle: 'planification', nom: 'Planifier', Ecran: Planification },
  { cle: 'suivi', nom: 'Suivi', Ecran: Suivi },
  { cle: 'reglages', nom: 'Réglages', Ecran: Reglages },
];

/**
 * Dit s'il existe une version plus récente que celle qui tourne. Une
 * application posée sur l'écran d'accueil n'est jamais rechargée : sans cet
 * avis, un téléphone garde l'ancienne version des semaines.
 */
function useMiseAJour() {
  const [disponible, setDisponible] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) return undefined;
    const verifier = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        const { build } = await r.json();
        if (build && build !== __BUILD_STAMP__) setDisponible(true);
      } catch {
        // Hors ligne : on réessaiera au prochain retour au premier plan.
      }
    };
    const auRetour = () => { if (document.visibilityState === 'visible') verifier(); };
    verifier();
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, []);
  return disponible;
}

function Coquille() {
  const [onglet, setOnglet] = useState('apercu');
  const miseAJour = useMiseAJour();
  const { Ecran } = ONGLETS.find((o) => o.cle === onglet);
  // Arrivé par une invitation, le code reste dans l'adresse jusqu'ici. On
  // l'efface dès que la copropriété s'affiche — pas après la confirmation du
  // serveur, qui arrive parfois après l'affichage — pour que recharger ou
  // partager l'adresse ne le repropose pas.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  // Chaque onglet s'ouvre en haut de page, pas là où le précédent était rendu.
  useEffect(() => { window.scrollTo(0, 0); }, [onglet]);
  return (
    <>
      {miseAJour ? (
        <div className="bandeau" role="status">
          Une nouvelle version est disponible.
          <button type="button" className="bouton texte" onClick={() => window.location.reload()}>Mettre à jour</button>
        </div>
      ) : null}
      {/* La barre titre reste en haut à tous les écrans : la marque, et la
          copropriété ouverte — sur Revenus ou Dépenses, rien d'autre ne
          disait de laquelle il s'agit. */}
      <header className="barre-titre">
        <div className="barre-titre-contenu">
          <span className="marque-app"><Logo taille={30} /><span>Mes copropriétés</span></span>
          <PastilleCopro />
        </div>
      </header>
      {/* La clé remonte l'écran à chaque changement d'onglet : c'est ce qui rejoue l'arrivée des cartes. */}
      <main className="page" key={onglet}><Ecran allerA={setOnglet} /></main>
      <div className="barre">
        <nav aria-label="Sections">
          <span className="glisseur" style={{ '--position': ONGLETS.findIndex((o) => o.cle === onglet) }} aria-hidden="true" />
          {ONGLETS.map((o) => (
            <button key={o.cle} type="button" aria-current={o.cle === onglet ? 'page' : undefined} onClick={() => setOnglet(o.cle)}>
              <span className="pastille"><Icone nom={o.cle} /></span>
              <span className="nom">{o.nom}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

function Aiguillage() {
  const { pret, user, copro } = useSession();
  if (!pret) return <div className="centre"><p className="discret" role="status">Chargement…</p></div>;
  if (!user) return <Connexion />;
  if (!copro) return <Bienvenue />;
  return <Coquille />;
}

function AvecSession() {
  const toast = useToast();
  return <SessionProvider surErreur={toast}><Aiguillage /></SessionProvider>;
}

export default function App() {
  if (!configure) {
    return (
      <div className="centre">
        <div className="carte">
          <h1>Configuration manquante</h1>
          <p>Ce site n'est pas encore relié à son projet Firebase : les variables <code>VITE_FIREBASE_…</code> ne sont pas renseignées.</p>
          <p className="discret">Voir <code>.env.example</code> et le <code>README.md</code> du dépôt.</p>
        </div>
      </div>
    );
  }
  return <Toasts><AvecSession /></Toasts>;
}
