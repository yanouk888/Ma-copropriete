import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useSession, messageErreur } from '../donnees/Session';
import { PAIES, totalProportions } from '../calc/budget';
import { TYPES, empechement, actives, activer, desactiver } from '../donnees/notifications';
import { lireMontant } from '../donnees/format';
import { Feuille, Champ, Bascule, Avis, Icone, useToast } from '../composants/ui';

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
  return (
    <section className="carte">
      <header><h2>Inviter</h2></header>
      <p className="discret">Donnez ce code à la personne à inviter. Elle crée son compte, puis l'entre à l'accueil.</p>
      <div className="ligne" style={{ alignItems: 'center' }}>
        <span className="code">{copro.code}</span>
        <button className="icone-bouton" onClick={copier} aria-label="Copier le code"><Icone nom="copier" /></button>
      </div>
      <p className="discret">Ce code ouvre toutes les finances de la copropriété : ne le donnez qu'à un copropriétaire.</p>
      {estGestionnaire ? <button className="bouton contour" onClick={changer}>Créer un nouveau code</button> : null}
    </section>
  );
}

function FeuilleProportions({ onFermer }) {
  const { copro, actions } = useSession();
  const [valeurs, setValeurs] = useState(() =>
    Object.fromEntries(Object.entries(copro.members).map(([uid, m]) => [uid, String(m.proportion).replace('.', ',')])));
  const total = Object.values(valeurs).reduce((s, v) => s + (lireMontant(v) || 0), 0);
  const valide = Math.abs(total - 100) < 0.01 && Object.values(valeurs).every((v) => lireMontant(v) >= 0);

  const enregistrer = (e) => {
    e.preventDefault();
    if (!valide) return;
    // Un chemin par membre (« members.uid.proportion ») : on ne réécrit pas la
    // fiche entière, qu'un autre appareil a pu modifier entre-temps.
    actions.modifier(copro.id, Object.fromEntries(
      Object.entries(valeurs).map(([uid, v]) => [`members.${uid}.proportion`, Math.round(lireMontant(v) * 100) / 100])));
    onFermer();
  };

  return (
    <Feuille titre="Proportions" onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <p className="discret">La part de ce qui manque chaque mois que verse chacun. Le total doit faire 100 %.</p>
        {Object.entries(copro.members).map(([uid, m]) => (
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
  const { copro, user, estGestionnaire, actions } = useSession();
  const toast = useToast();
  const [proportions, setProportions] = useState(false);
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
        <h2>Copropriétaires</h2>
        {estGestionnaire ? <button className="bouton texte" onClick={() => setProportions(true)}>Proportions</button> : null}
      </header>
      {Math.abs(total - 100) > 0.01 ? (
        <Avis ton="attention">Les proportions totalisent {Math.round(total * 100) / 100} %. {estGestionnaire ? 'Répartissez-les pour que les versements soient justes.' : 'Le gestionnaire doit les répartir.'}</Avis>
      ) : null}
      <div className="liste">
        {Object.entries(copro.members).map(([uid, m]) => (
          <div className="element" key={uid} style={{ cursor: 'default', flexWrap: 'wrap' }}>
            <div className="corps">
              <strong>{m.displayName}{uid === user.uid ? ' (vous)' : ''}</strong>
              <span className="discret">{m.proportion} %{uid === copro.gestionnaire ? ' · gestionnaire' : ''}</span>
            </div>
            {estGestionnaire && uid !== user.uid ? (
              <div className="boutons">
                <button className="bouton texte" onClick={() => ceder(uid, m)}>Céder la gestion</button>
                <button className="bouton texte" style={{ color: 'var(--alerte)' }} onClick={() => retirer(uid, m)}>Retirer</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <Champ libelle="Je verse ma part" aide="Sert à dire combien verser à chaque paie.">
        <select value={moi.frequencePaie} onChange={(e) => actions.modifier(copro.id, { [`members.${user.uid}.frequencePaie`]: e.target.value })}>
          {Object.entries(PAIES).map(([cle, p]) => <option key={cle} value={cle}>{p.libelle}</option>)}
        </select>
      </Champ>
      {proportions ? <FeuilleProportions onFermer={() => setProportions(false)} /> : null}
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
      {actif ? TYPES.map((t) => (
        <Bascule key={t.cle} libelle={t.libelle} coche={preferences[t.cle] !== false}
          onChange={(v) => actions.majProfil({ notifications: { [t.cle]: v } })} />
      )) : null}
    </section>
  );
}

function Compte() {
  const { copro, user, estGestionnaire, actions } = useSession();
  const toast = useToast();
  const [nom, setNom] = useState(copro.members[user.uid].displayName);
  const [nomCopro, setNomCopro] = useState(copro.nom);
  const autres = copro.memberUids.filter((u) => u !== user.uid);

  const renommer = async (e) => {
    e.preventDefault();
    const propre = nom.trim();
    if (!propre) return;
    actions.modifier(copro.id, { [`members.${user.uid}.displayName`]: propre });
    try { await updateProfile(user, { displayName: propre }); } catch { /* le nom dans la copropriété est celui qui compte */ }
    toast('Nom enregistré.');
  };
  const renommerCopro = (e) => {
    e.preventDefault();
    if (!nomCopro.trim()) return;
    actions.modifier(copro.id, { nom: nomCopro.trim() });
    toast('Nom enregistré.');
  };
  const quitter = async () => {
    try {
      if (!autres.length) {
        if (!window.confirm('Vous êtes le seul copropriétaire : quitter supprime la copropriété et toutes ses données. Continuer ?')) return;
        await actions.supprimerCopro(copro);
        return;
      }
      if (!window.confirm('Quitter cette copropriété ? Vous n\'en verrez plus les données.')) return;
      // Le gestionnaire qui part cède la gestion au premier des autres : une
      // copropriété sans gestionnaire ne pourrait plus répartir ses parts.
      await actions.quitter(copro, autres[0]);
    } catch (e) { toast(messageErreur(e)); }
  };

  return (
    <section className="carte">
      <header><h2>Compte</h2></header>
      <form className="champ" style={{ gap: 8 }} onSubmit={renommer}>
        <Champ libelle="Mon nom"><input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} required /></Champ>
        {nom.trim() !== copro.members[user.uid].displayName ? <button className="bouton doux">Enregistrer le nom</button> : null}
      </form>
      {estGestionnaire ? (
        <form className="champ" style={{ gap: 8 }} onSubmit={renommerCopro}>
          <Champ libelle="Nom de la copropriété"><input value={nomCopro} onChange={(e) => setNomCopro(e.target.value)} maxLength={60} required /></Champ>
          {nomCopro.trim() !== copro.nom ? <button className="bouton doux">Enregistrer le nom</button> : null}
        </form>
      ) : null}
      <p className="discret">Connecté : {user.email}</p>
      <div className="boutons">
        <button className="bouton contour" onClick={actions.deconnexion}>Se déconnecter</button>
        <button className="bouton danger" onClick={quitter}>Quitter la copropriété</button>
      </div>
    </section>
  );
}

function APropos() {
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
      <button className="bouton contour" onClick={() => window.location.reload()}>Rechercher une mise à jour</button>
    </section>
  );
}

export default function Reglages() {
  return (
    <>
      <div className="entete"><div><h1>Réglages</h1></div></div>
      <Coproprietaires />
      <Inviter />
      <Notifications />
      <Compte />
      <APropos />
    </>
  );
}
