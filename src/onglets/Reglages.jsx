import { useLayoutEffect, useRef, useState } from 'react';
import { useSession, messageErreur } from '../donnees/Session';
import { PAIES, totalProportions } from '../calc/budget';
import { TYPES, empechement, actives, activer, desactiver } from '../donnees/notifications';
import { lireMontant } from '../donnees/format';
import { chercherMiseAJour } from '../donnees/miseAJour';
import { Feuille, Champ, ChampMois, Bascule, Avis, Icone, useToast } from '../composants/ui';
import { proprietairesActifs, anciensProprietaires } from '../calc/proprietaires';
import { moisDe, libelleMois } from '../calc/mois';

function Inviter() {
  const { copro, estGestionnaire, actions } = useSession();
  const toast = useToast();
  const copier = async () => {
    try { await navigator.clipboard.writeText(copro.code); toast('Code copié.'); } catch { toast('Copie impossible : recopiez le code à la main.'); }
  };
  const changer = async () => {
    if (!window.confirm('Créer un nouveau code ? L\'ancien cessera de fonctionner. Les copropriétaires déjà entrés ne sont pas touchés.')) return;
    try { await actions.changerCode(copro); toast('Nouveau code créé.'); } catch (e) { toast(messageErreur(e)); }
  };
  const [courriel, setCourriel] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const inviter = async (e) => {
    e.preventDefault();
    // Le navigateur accepte « nom@x » (sans point) comme courriel ; la
    // fonction le refuserait. Autant le dire tout de suite, sans aller-retour.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel.trim())) { toast('Ce courriel n\'est pas valide.'); return; }
    setEnvoi(true);
    try {
      await actions.inviterParCourriel(copro.id, courriel.trim());
      toast(`Invitation envoyée à ${courriel.trim()}.`);
      setCourriel('');
    } catch (err) { toast(messageErreur(err)); } finally { setEnvoi(false); }
  };
  return (
    <section className="carte">
      <header><h2>Inviter</h2></header>
      <form className="champ" style={{ gap: 8 }} onSubmit={inviter}>
        <Champ libelle="Inviter par courriel" aide="La personne reçoit le code et un bouton qui ouvre l'application avec le code déjà rempli.">
          <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="nom@exemple.ca" autoComplete="off" required />
        </Champ>
        <button className="bouton" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer l\'invitation'}</button>
      </form>
      <div className="separateur">ou donnez le code</div>
      <div className="ligne" style={{ alignItems: 'center' }}>
        <span className="code">{copro.code}</span>
        <button className="icone-bouton" onClick={copier} aria-label="Copier le code"><Icone nom="copier" /></button>
      </div>
      <p className="discret">Ce code ouvre toutes les finances de la copropriété : ne le donnez qu'à un copropriétaire.</p>
      {estGestionnaire ? <button className="bouton contour" onClick={changer}>Créer un nouveau code</button> : null}
    </section>
  );
}

// Deux répartitions distinctes, réglées par le gestionnaire :
//  - la proportion : la part de ce qui manque chaque mois que verse chacun ;
//  - la part de propriété : celle de l'acte, que chacun déclare à l'impôt.
// Elles diffèrent souvent (50/50 sur l'acte, 60/40 dans les versements).
const REPARTITIONS = {
  proportion: { titre: 'Proportions', texte: 'La part de ce qui manque chaque mois que verse chacun. Le total doit faire 100 %.' },
  propriete: { titre: 'Parts de propriété', texte: 'La part de chacun dans l\'immeuble, selon l\'acte : c\'est elle que chacun déclare à l\'impôt (rapport annuel). Le total doit faire 100 %.' },
};

function FeuilleProportions({ champ = 'proportion', onFermer }) {
  const { copro, actions } = useSession();
  const { titre, texte } = REPARTITIONS[champ];
  const [valeurs, setValeurs] = useState(() =>
    // Pas encore de part de propriété : on part de la proportion des versements.
    Object.fromEntries(Object.entries(copro.members).filter(([, m]) => !m.venduLe).map(([uid, m]) => [uid, String(m[champ] ?? m.proportion).replace('.', ',')])));
  const total = Object.values(valeurs).reduce((s, v) => s + (lireMontant(v) || 0), 0);
  const valide = Math.abs(total - 100) < 0.01 && Object.values(valeurs).every((v) => lireMontant(v) >= 0);

  const enregistrer = (e) => {
    e.preventDefault();
    if (!valide) return;
    // Un chemin par membre (« members.uid.proportion ») : on ne réécrit pas la
    // fiche entière, qu'un autre appareil a pu modifier entre-temps.
    actions.modifier(copro.id, Object.fromEntries(
      Object.entries(valeurs).map(([uid, v]) => [`members.${uid}.${champ}`, Math.round(lireMontant(v) * 100) / 100])));
    onFermer();
  };

  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <p className="discret">{texte}</p>
        {Object.entries(copro.members).filter(([uid]) => uid in valeurs).map(([uid, m]) => (
          <Champ key={uid} libelle={`${m.displayName} (%)`}>
            <input type="text" inputMode="decimal" value={valeurs[uid]} onChange={(e) => setValeurs({ ...valeurs, [uid]: e.target.value })} />
          </Champ>
        ))}
        <div className="ligne total"><span>Total</span><span className={`chiffre ${valide ? 'bon' : 'mauvais'}`}>{Math.round(total * 100) / 100} %</span></div>
        <div className="pied">
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton" disabled={!valide}>Enregistrer</button>
        </div>
      </form>
    </Feuille>
  );
}

function Coproprietaires() {
  const { copro, user, estGestionnaire, lectureSeule, actions } = useSession();
  const toast = useToast();
  const [proportions, setProportions] = useState(null);
  const total = totalProportions(copro);
  const moi = copro.members[user.uid];

  const retirer = (uid, m) => {
    if (!window.confirm(`Retirer ${m.displayName} de la copropriété ? Pensez ensuite à créer un nouveau code d'invitation, sinon l'ancien lui permettrait de revenir.`)) return;
    const { [uid]: _, ...reste } = copro.members;
    actions.modifier(copro.id, { memberUids: copro.memberUids.filter((u) => u !== uid), members: reste });
  };
  const ceder = (uid, m) => {
    if (!window.confirm(`Céder la gestion à ${m.displayName} ? Vous ne pourrez plus modifier les proportions ni retirer quelqu'un.`)) return;
    actions.modifier(copro.id, { gestionnaire: uid });
    toast(`${m.displayName} gère maintenant la copropriété.`);
  };

  return (
    <section className="carte">
      <header>
        <h2>Parts et versements</h2>
        {estGestionnaire && !lectureSeule ? (
          <div className="boutons">
            <button className="bouton texte" onClick={() => setProportions('proportion')}>Proportions</button>
            <button className="bouton texte" onClick={() => setProportions('propriete')}>Propriété</button>
          </div>
        ) : null}
      </header>
      {Math.abs(total - 100) > 0.01 ? (
        <Avis ton="attention">Les proportions totalisent {Math.round(total * 100) / 100} %. {estGestionnaire ? 'Répartissez-les pour que les versements soient justes.' : 'Le gestionnaire doit les répartir.'}</Avis>
      ) : null}
      <div className="liste">
        {Object.entries(copro.members).filter(([, m]) => !m.venduLe).map(([uid, m]) => (
          <div className="element" key={uid} style={{ cursor: 'default', flexWrap: 'wrap' }}>
            <div className="corps">
              <strong>{m.displayName}{uid === user.uid ? ' (vous)' : ''}</strong>
              <span className="discret">Verse {m.proportion} % · propriétaire à {m.propriete ?? m.proportion} %{uid === copro.gestionnaire ? ' · gestionnaire' : ''}</span>
            </div>
            {estGestionnaire && !lectureSeule && uid !== user.uid ? (
              <div className="boutons">
                <button className="bouton texte" onClick={() => ceder(uid, m)}>Céder la gestion</button>
                <button className="bouton texte" style={{ color: 'var(--alerte)' }} onClick={() => retirer(uid, m)}>Retirer</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {lectureSeule ? null : <Champ libelle="Je verse ma part" aide="Sert à dire combien verser à chaque paie.">
        <select value={moi.frequencePaie} onChange={(e) => actions.modifier(copro.id, { [`members.${user.uid}.frequencePaie`]: e.target.value })}>
          {Object.entries(PAIES).map(([cle, p]) => <option key={cle} value={cle}>{p.libelle}</option>)}
        </select>
      </Champ>}
      {proportions ? <FeuilleProportions champ={proportions} onFermer={() => setProportions(null)} /> : null}
    </section>
  );
}

function Notifications() {
  const { user, profil, actions } = useSession();
  const toast = useToast();
  const [actif, setActif] = useState(actives());
  const [occupe, setOccupe] = useState(false);
  const obstacle = empechement();
  const preferences = profil?.notifications || {};

  const basculer = async (voulu) => {
    setOccupe(true);
    try {
      if (voulu) await activer(user.uid); else await desactiver(user.uid);
      setActif(voulu);
    } catch (e) { toast(messageErreur(e)); } finally { setOccupe(false); }
  };

  return (
    <section className="carte">
      <header><h2>Notifications</h2></header>
      {obstacle && !actif ? <Avis ton="info">{obstacle}</Avis> : (
        <Bascule libelle="Recevoir les notifications sur cet appareil" coche={actif} disabled={occupe} onChange={basculer} />
      )}
      <Bascule libelle="Résumé mensuel par courriel" aide="Le premier du mois : autosuffisance, votre part, solde prévu."
        coche={profil?.courriels?.resume !== false} onChange={(v) => actions.majProfil({ courriels: { resume: v } })} />
      {actif ? TYPES.map((t) => (
        <Bascule key={t.cle} libelle={t.libelle} coche={preferences[t.cle] !== false}
          onChange={(v) => actions.majProfil({ notifications: { [t.cle]: v } })} />
      )) : null}
    </section>
  );
}

/**
 * Les façons de se connecter à ce compte. Lier Google permet ensuite d'entrer
 * d'un toucher, sans mot de passe, et retrouver les mêmes copropriétés.
 */
function ConnexionGoogle() {
  const { user, actions } = useSession();
  const toast = useToast();
  const [occupe, setOccupe] = useState(false);
  const google = user.providerData.find((p) => p.providerId === 'google.com');
  const motDePasse = user.providerData.some((p) => p.providerId === 'password');
  const lancer = async (geste) => {
    setOccupe(true);
    // Pas de « finally » qui remettrait occupe à faux : en cas de réussite, la
    // page se recharge, et le bouton doit rester inactif jusque-là.
    try { await geste(); } catch (e) { toast(messageErreur(e)); setOccupe(false); }
  };
  return (
    <div className="ligne" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <span>
        <strong>Google</strong><br />
        <small className="discret">{google ? `Lié : ${google.email}` : 'Non lié'}</small>
      </span>
      {!google ? (
        <button type="button" className="bouton contour" disabled={occupe} onClick={() => lancer(actions.lierGoogle)}>Lier mon compte Google</button>
      ) : motDePasse ? (
        // Sans mot de passe, Google est la seule porte d'entrée : on ne la ferme pas.
        <button type="button" className="bouton texte" disabled={occupe}
          onClick={() => { if (window.confirm('Dissocier Google ? Vous vous connecterez ensuite avec votre courriel et votre mot de passe.')) lancer(actions.dissocierGoogle); }}>Dissocier</button>
      ) : null}
    </div>
  );
}

function Profil() {
  const { copro, user, actions } = useSession();
  const toast = useToast();
  const [nom, setNom] = useState(copro.members[user.uid].displayName);

  const renommer = (e) => {
    e.preventDefault();
    const propre = nom.trim();
    if (!propre) return;
    actions.modifier(copro.id, { [`members.${user.uid}.displayName`]: propre });
    // Dans le profil Firestore, pas dans le compte : voir Session.jsx (inscription).
    actions.majProfil({ nom: propre });
    toast('Nom enregistré.');
  };

  return (
    <section className="carte">
      <header><h2>Mon profil</h2></header>
      <form className="champ" style={{ gap: 8 }} onSubmit={renommer}>
        <Champ libelle="Mon nom"><input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} required /></Champ>
        {nom.trim() !== copro.members[user.uid].displayName ? <button className="bouton doux">Enregistrer le nom</button> : null}
      </form>
      <p className="discret">Connecté : {user.email}</p>
      <ConnexionGoogle />
      {/* Une adresse non vérifiée n'empêche rien ; mais si elle est fausse,
          « mot de passe oublié » et le résumé mensuel n'arriveront jamais. */}
      {!user.emailVerified && user.providerData.some((p) => p.providerId === 'password') ? (
        <Avis ton="attention">Votre adresse n'est pas encore vérifiée.{' '}
          <button className="bouton texte" onClick={async () => {
            try { await actions.renvoyerVerification(); toast('Courriel de vérification envoyé.'); } catch (e) { toast(messageErreur(e)); }
          }}>Renvoyer le courriel</button>
        </Avis>
      ) : null}
      <button className="bouton contour" onClick={actions.deconnexion}>Se déconnecter</button>
    </section>
  );
}

function FeuilleVentePart({ onFermer }) {
  const { copro, actions } = useSession();
  const toast = useToast();
  const actifs = proprietairesActifs(copro);
  const vendeurs = actifs.filter((p) => Number(p.propriete ?? p.proportion) > 0);
  const [vendeur, setVendeur] = useState(vendeurs[0]?.uid || '');
  const acheteurs = actifs.filter((p) => p.uid !== vendeur);
  const [acheteur, setAcheteur] = useState('');
  const choisi = acheteurs.some((p) => p.uid === acheteur) ? acheteur : acheteurs[0]?.uid || '';
  const [mois, setMois] = useState(moisDe());
  const [occupe, setOccupe] = useState(false);
  const v = copro.members[vendeur];
  const a = copro.members[choisi];

  const vendre = async (e) => {
    e.preventDefault();
    setOccupe(true);
    try {
      await actions.vendrePart(copro, vendeur, choisi, mois);
      toast(`Vente inscrite : ${a.displayName} détient la part de ${v.displayName}.`);
      onFermer();
    } catch (err) { toast(messageErreur(err)); setOccupe(false); }
  };

  return (
    <Feuille titre="Vendre une part" onFermer={onFermer}>
      <form onSubmit={vendre}>
        <p className="discret">L'acheteur doit d'abord entrer avec le code d'invitation (il arrive à 0 %). Il reprend toute la part du vendeur — propriété et versements.</p>
        {acheteurs.length ? (
          <>
            <Champ libelle="Vendeur">
              <select value={vendeur} onChange={(e) => setVendeur(e.target.value)}>
                {vendeurs.map((p) => <option key={p.uid} value={p.uid}>{p.displayName} ({p.propriete ?? p.proportion} %)</option>)}
              </select>
            </Champ>
            <Champ libelle="Acheteur">
              <select value={choisi} onChange={(e) => setAcheteur(e.target.value)}>
                {acheteurs.map((p) => <option key={p.uid} value={p.uid}>{p.displayName}</option>)}
              </select>
            </Champ>
            <ChampMois libelle="L'acheteur la détient à partir de" valeur={mois} onChange={setMois}
              aide="Le vendeur déclare les mois d'avant, l'acheteur ceux d'après. Le vendeur garde l'accès, en lecture, pour son impôt." />
            {v && a ? (
              <Avis ton="info">{v.displayName} cède {v.propriete ?? v.proportion} % de propriété et {v.proportion} % des versements à {a.displayName}, à partir de {libelleMois(mois)}.</Avis>
            ) : null}
          </>
        ) : <Avis ton="attention">Personne à qui vendre : invitez d'abord l'acheteur avec le code de la propriété.</Avis>}
        <div className="pied">
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton" disabled={occupe || !acheteurs.length}>Inscrire la vente</button>
        </div>
      </form>
    </Feuille>
  );
}

function FeuilleVenteCopro({ onFermer }) {
  const { copro, actions } = useSession();
  const toast = useToast();
  const [mois, setMois] = useState(moisDe());
  const [occupe, setOccupe] = useState(false);
  const vendre = async (e) => {
    e.preventDefault();
    setOccupe(true);
    try { await actions.vendreCopro(copro, mois); toast(`${copro.nom} est inscrite comme vendue.`); onFermer(); } catch (err) { toast(messageErreur(err)); setOccupe(false); }
  };
  return (
    <Feuille titre="Vendre la propriété" onFermer={onFermer}>
      <form onSubmit={vendre}>
        <p className="discret">Tous les propriétaires vendent. La propriété reste consultable — rapport annuel, pièces jointes — mais ne se modifie plus, et sort de vos totaux. Une vente inscrite par erreur s'annule.</p>
        <ChampMois libelle="Vendue en" valeur={mois} onChange={setMois} />
        <div className="pied">
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton danger" disabled={occupe}>Inscrire la vente</button>
        </div>
      </form>
    </Feuille>
  );
}

function CetteCopro() {
  const { copro, user, estGestionnaire, lectureSeule, actions } = useSession();
  const toast = useToast();
  const [nomCopro, setNomCopro] = useState(copro.nom);
  const [entreprise, setEntreprise] = useState(copro.entreprise || '');
  const [vente, setVente] = useState(null);
  const autres = copro.memberUids.filter((u) => u !== user.uid);
  const actifs = proprietairesActifs(copro);
  const anciens = anciensProprietaires(copro);
  const peutGerer = estGestionnaire && !lectureSeule;

  const enregistrer = (e) => {
    e.preventDefault();
    if (!nomCopro.trim()) return;
    actions.modifier(copro.id, { nom: nomCopro.trim(), entreprise: entreprise.trim() });
    toast('Enregistré.');
  };
  const quitter = async () => {
    try {
      if (!autres.length) {
        if (!window.confirm('Vous êtes le seul copropriétaire : quitter supprime la propriété et toutes ses données. Continuer ?')) return;
        await actions.supprimerCopro(copro);
        return;
      }
      if (!window.confirm('Quitter cette propriété ? Vous n\'en verrez plus les données, ni son rapport annuel.')) return;
      // Le gestionnaire qui part cède la gestion au premier des autres : une
      // propriété sans gestionnaire ne pourrait plus répartir ses parts.
      await actions.quitter(copro, autres.find((u) => !copro.members[u].venduLe) || autres[0]);
    } catch (e) { toast(messageErreur(e)); }
  };
  const annuler = async () => {
    if (!window.confirm('Annuler la vente ? La propriété redevient modifiable par tous ses propriétaires.')) return;
    try { await actions.annulerVente(copro); toast('Vente annulée.'); } catch (e) { toast(messageErreur(e)); }
  };
  const change = nomCopro.trim() !== copro.nom || entreprise.trim() !== (copro.entreprise || '');

  return (
    <section className="carte">
      <header><h2>Cette propriété</h2></header>
      {peutGerer ? (
        <form className="champ" style={{ gap: 8 }} onSubmit={enregistrer}>
          <Champ libelle="Gérée par" aide="L'entreprise qui gère la propriété ; elle titre la barre du haut.">
            <input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} maxLength={60} placeholder="Gestion Exemple inc." />
          </Champ>
          <Champ libelle="Nom de la propriété"><input value={nomCopro} onChange={(e) => setNomCopro(e.target.value)} maxLength={60} required /></Champ>
          {change ? <button className="bouton doux">Enregistrer</button> : null}
        </form>
      ) : (
        <div>
          {copro.entreprise ? <div className="ligne"><span className="discret">Gérée par</span><span>{copro.entreprise}</span></div> : null}
          <div className="ligne"><span className="discret">Propriété</span><span>{copro.nom}</span></div>
        </div>
      )}
      <div className="liste proprietaires">
        <strong className="petit-titre">Propriétaires</strong>
        {actifs.map((p) => (
          <div className="ligne" key={p.uid}>
            <span>{p.displayName}{p.uid === user.uid ? ' (vous)' : ''}</span>
            <span className="chiffre">{p.propriete ?? p.proportion} %</span>
          </div>
        ))}
        {anciens.map((p) => (
          <div className="ligne discret" key={p.uid}>
            <span>{p.displayName}{p.uid === user.uid ? ' (vous)' : ''}</span>
            <span>a vendu en {libelleMois(p.venduLe)}</span>
          </div>
        ))}
      </div>
      {copro.vendue ? <Avis ton="info">Vendue en {libelleMois(copro.vendue.mois)}.</Avis> : null}
      <div className="boutons">
        {peutGerer ? <button className="bouton contour" onClick={() => setVente('part')}>Vendre une part</button> : null}
        {peutGerer ? <button className="bouton contour" onClick={() => setVente('tout')}>Vendre la propriété</button> : null}
        {estGestionnaire && copro.vendue ? <button className="bouton contour" onClick={annuler}>Annuler la vente</button> : null}
        <button className="bouton danger" onClick={quitter}>Quitter la propriété</button>
      </div>
      {!estGestionnaire && !lectureSeule ? <p className="discret">Pour inscrire une vente, demandez au gestionnaire.</p> : null}
      {vente === 'part' ? <FeuilleVentePart onFermer={() => setVente(null)} /> : null}
      {vente === 'tout' ? <FeuilleVenteCopro onFermer={() => setVente(null)} /> : null}
    </section>
  );
}

function APropos() {
  const toast = useToast();
  const note = __NOUVEAUTES__;
  return (
    <section className="carte">
      <header><h2>À propos</h2></header>
      <div>
        <div className="ligne"><span>Version installée</span><span className="chiffre">{__APP_VERSION__}</span></div>
        <div className="ligne"><span className="discret">Compilation</span><span className="chiffre discret">{__BUILD_NUMBER__}</span></div>
      </div>
      <div className="notes">
        <strong>{note.courante ? 'Nouveautés de cette version' : `Dernière nouveauté (${note.version})`}</strong>
        {/* Le HTML vient du CHANGELOG du dépôt, échappé à la compilation par nouveautes.mjs : rien qu'un utilisateur ait saisi. */}
        <div dangerouslySetInnerHTML={{ __html: note.html }} />
      </div>
      {note.historique.length ? (
        <details>
          <summary>Versions précédentes</summary>
          {note.historique.map((h) => (
            <div className="notes" key={h.version}>
              <strong>{h.version}{h.date ? ` — ${h.date}` : ''}</strong>
              <div dangerouslySetInnerHTML={{ __html: h.html }} />
            </div>
          ))}
        </details>
      ) : null}
      <button className="bouton contour" onClick={async () => {
        if (!(await chercherMiseAJour({ recharger: true, forcer: true }))) toast('Vous avez déjà la dernière version.');
      }}>Rechercher une mise à jour</button>
    </section>
  );
}

// Comme Budget Maison : une page par sujet plutôt qu'une longue colonne de
// cartes, où « Quitter » finissait sous « Notifications ».
const SECTIONS = [
  { cle: 'profil', nom: 'Profil', Contenu: Profil },
  { cle: 'copropriete', nom: 'Propriété', Contenu: () => <><CetteCopro /><Coproprietaires /><Inviter /></> },
  { cle: 'notifications', nom: 'Notifications', Contenu: Notifications },
  { cle: 'apropos', nom: 'À propos', Contenu: APropos },
];

export default function Reglages({ sousOnglet }) {
  const [cle, setCle] = useState(() => (SECTIONS.some((s) => s.cle === sousOnglet) ? sousOnglet : 'profil'));
  const rang = SECTIONS.findIndex((s) => s.cle === cle);
  // Le sens de l'arrivée suit celui du geste : vers la droite, la page vient de la droite.
  const [sens, setSens] = useState(1);
  const { Contenu } = SECTIONS[rang];
  const choisir = (c) => { setSens(SECTIONS.findIndex((s) => s.cle === c) >= rang ? 1 : -1); setCle(c); };
  // Chaque onglet a la largeur de son mot : à parts égales, « Notifications »
  // était coupé à 390 px. La pilule mesure donc l'onglet choisi.
  const barre = useRef(null);
  const [pilule, setPilule] = useState(null);
  useLayoutEffect(() => {
    const mesurer = () => {
      const b = barre.current?.querySelectorAll('[role="tab"]')[rang];
      if (b) setPilule({ x: b.offsetLeft, l: b.offsetWidth });
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [rang]);
  return (
    <>
      <div className="sous-onglets" ref={barre} role="tablist" aria-label="Sections des réglages">
        {pilule ? <span className="sous-glisseur" style={{ width: pilule.l, transform: `translateX(${pilule.x}px)` }} aria-hidden="true" /> : null}
        {SECTIONS.map((s) => (
          <button key={s.cle} type="button" role="tab" aria-selected={s.cle === cle} onClick={() => choisir(s.cle)}>{s.nom}</button>
        ))}
      </div>
      <div className="section-reglages" key={cle} role="tabpanel" style={{ '--sens': sens }}>
        <Contenu />
      </div>
    </>
  );
}
