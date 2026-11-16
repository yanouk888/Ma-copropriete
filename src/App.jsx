import { useEffect, useState } from 'react';
import { configure } from './firebase';
import { SessionProvider, useSession } from './donnees/Session';
import { Icone, Toasts, useToast } from './composants/ui';
import Connexion from './pages/Connexion';
import Logo from './composants/Logo';
import BarreDuHaut, { Chevron } from './composants/BarreDuHaut';
import { libelleMois } from './calc/mois';
import AvisMiseAJour from './composants/AvisMiseAJour';
import { FeuilleMesCopros } from './composants/MesCopros';
import MenuProfil from './composants/MenuProfil';
import { signalerPrete } from './donnees/amorce';
import Bienvenue from './pages/Bienvenue';
import Apercu from './onglets/Apercu';
import Revenus from './onglets/Revenus';
import Depenses from './onglets/Depenses';
import Planification from './onglets/Planification';
import Suivi from './onglets/Suivi';
import Reglages from './onglets/Reglages';

// L'ordre de ce tableau est celui de la navigation. Comme Budget Maison :
// quatre destinations dans la barre du bas, les autres sous « Plus », dans
// une feuille qui dit en une ligne à quoi chacune sert.
const ONGLETS = [
  { cle: 'apercu', nom: 'Aperçu', titre: 'Aperçu', Ecran: Apercu },
  { cle: 'revenus', nom: 'Revenus', titre: 'Revenus', Ecran: Revenus },
  { cle: 'depenses', nom: 'Dépenses', titre: 'Dépenses', Ecran: Depenses },
  { cle: 'suivi', nom: 'Suivi', titre: 'Suivi', Ecran: Suivi },
  { cle: 'planification', nom: 'Planifier', titre: 'Planification', Ecran: Planification, plus: 'Le solde du compte sur 13 mois, et les ajustements' },
  { cle: 'reglages', nom: 'Réglages', titre: 'Réglages', Ecran: Reglages, plus: 'Profil, copropriétaires, invitation, notifications' },
];
const DANS_LA_BARRE = ONGLETS.filter((o) => !o.plus);
const SOUS_PLUS = ONGLETS.filter((o) => o.plus);

function Coquille() {
  // « reglages:profil » ouvre Réglages sur un sous-onglet (menu de l'avatar).
  const [cible, setCible] = useState('apercu');
  const [onglet, sousOnglet] = cible.split(':');
  const [plus, setPlus] = useState(false);
  const [copros, setCopros] = useState(false);
  const { copro, lectureSeule, user } = useSession();
  const courant = ONGLETS.find((o) => o.cle === onglet);
  const { Ecran } = courant;
  const allerA = (c) => { setPlus(false); setCible(c); };
  // Arrivé par une invitation, le code reste dans l'adresse jusqu'ici. On
  // l'efface dès que la copropriété s'affiche — pas après la confirmation du
  // serveur, qui arrive parfois après l'affichage — pour que recharger ou
  // partager l'adresse ne le repropose pas.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  // Chaque onglet s'ouvre en haut de page, pas là où le précédent était rendu.
  useEffect(() => { window.scrollTo(0, 0); }, [cible]);
  // La pilule : sur l'onglet ouvert, ou sur « Plus » s'il porte la page.
  const rang = DANS_LA_BARRE.findIndex((o) => o.cle === onglet);
  const rangPilule = rang >= 0 ? rang : DANS_LA_BARRE.length;
  const plusActif = plus || rang < 0;
  return (
    <>
      {/* La barre du haut : l'entreprise qui gère l'immeuble, et dessous
          l'immeuble ouvert ; le tout se touche pour changer d'immeuble. La
          page ouverte se lit dans la barre du bas. Sans entreprise saisie,
          l'immeuble seul. À droite, la cloche et l'avatar. */}
      <BarreDuHaut>
        <button type="button" className="titre-page" onClick={() => setCopros(true)} aria-haspopup="dialog"
          aria-label={`${copro.entreprise ? `${copro.entreprise}, ` : ''}${copro.nom}${courant ? `, page ${courant.titre}` : ''}. Changer de propriété`}>
          <Logo taille={36} />
          <span className="titre-page-textes">
            <span className="titre-page-nom">{copro.entreprise || copro.nom}</span>
            {copro.entreprise ? <span className="titre-page-copro"><span>{copro.nom}</span>{Chevron}</span> : null}
          </span>
          {copro.entreprise ? null : Chevron}
        </button>
        <MenuProfil allerA={allerA} />
      </BarreDuHaut>
      {copros ? <FeuilleMesCopros onFermer={() => setCopros(false)} /> : null}
      {/* La clé remonte l'écran à chaque changement d'onglet : c'est ce qui rejoue l'arrivée des cartes. */}
      <main className={`page${lectureSeule ? ' lecture-seule' : ''}`} key={cible}>
        {lectureSeule ? (
          <div className="bandeau-vendue" role="note">
            <strong>{copro.vendue ? `Vendue en ${libelleMois(copro.vendue.mois)}` : `Votre part vendue en ${libelleMois(copro.members[user.uid].venduLe)}`}</strong>
            <span>Elle se consulte — rapport annuel, pièces jointes — mais ne se modifie plus.</span>
          </div>
        ) : null}
        <Ecran allerA={allerA} sousOnglet={sousOnglet} />
      </main>
      <div className="barre">
        <nav aria-label="Sections">
          <span className="glisseur" style={{ '--position': rangPilule }} aria-hidden="true" />
          {DANS_LA_BARRE.map((o) => (
            <button key={o.cle} type="button" aria-current={o.cle === onglet && !plus ? 'page' : undefined} onClick={() => allerA(o.cle)}>
              <span className="pastille"><Icone nom={o.cle} /></span>
              <span className="nom">{o.nom}</span>
            </button>
          ))}
          <button type="button" aria-current={plusActif ? 'page' : undefined} aria-expanded={plus} onClick={() => setPlus(!plus)} aria-label="Plus de pages">
            <span className="pastille"><Icone nom="plus-pages" /></span>
            <span className="nom">Plus</span>
          </button>
        </nav>
      </div>
      {plus ? (
        <>
          <div className="voile-plus" onClick={() => setPlus(false)} />
          <div className="feuille-plus" role="dialog" aria-label="Autres pages">
            <div className="poignee" />
            <div className="menu-titre">Autres pages</div>
            {SOUS_PLUS.map((o, i) => (
              <button key={o.cle} type="button" className={`element plus-item${o.cle === onglet ? ' actif' : ''}`} style={{ '--i': i }} onClick={() => allerA(o.cle)}>
                <span className="tuile" style={{ '--teinte': 'var(--primaire)' }}><Icone nom={o.cle} /></span>
                <div className="corps"><strong>{o.titre}</strong><span className="discret">{o.plus}</span></div>
                <Icone nom="chevron" taille={18} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function Aiguillage() {
  const { pret, user, copro } = useSession();
  // L'écran d'amorçage part quand un vrai écran est prêt : connexion,
  // accueil ou copropriété. Pas sur « Chargement… ».
  useEffect(() => { if (pret) signalerPrete(); }, [pret]);
  if (!pret) return <div className="centre"><p className="discret" role="status">Chargement…</p></div>;
  if (!user) return <Connexion />;
  // Sans propriété, on entre quand même : un code ou une création, maintenant ou plus tard.
  if (!copro) return <Bienvenue />;
  return <Coquille />;
}

function AvecSession() {
  const toast = useToast();
  return <SessionProvider surErreur={toast}><Aiguillage /></SessionProvider>;
}

export default function App() {
  if (!configure) {
    signalerPrete();
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
  // La pastille vit au-dessus de tout : elle doit paraître aussi sur l'écran
  // de connexion, juste après une mise à jour.
  return <Toasts><AvisMiseAJour /><AvecSession /></Toasts>;
}
