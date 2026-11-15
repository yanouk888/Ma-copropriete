import { useState } from 'react';
import { useSession, messageErreur } from '../donnees/Session';
import { Champ, Avis } from '../composants/ui';

/** Premier écran après la connexion : on n'a pas encore de copropriété. */
export default function Bienvenue() {
  const { user, profil, actions } = useSession();
  const prenom = profil?.nom || user.displayName;
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const lancer = (geste) => async (e) => {
    e.preventDefault();
    setErreur('');
    setOccupe(true);
    try { await geste(); } catch (err) {
      // Les règles refusent un code périmé par « permission-denied » : dit
      // tel quel, on croirait à une panne.
      setErreur(err?.code === 'permission-denied' ? 'Ce code n\'est plus valide. Demandez-en un nouveau au gestionnaire.' : messageErreur(err));
      setOccupe(false);
    }
  };

  return (
    <div className="centre">
      <div className="carte">
        <div>
          <h1>Bonjour{prenom ? `, ${prenom}` : ''}</h1>
          <p className="discret">Rejoignez une copropriété existante, ou créez la vôtre.</p>
        </div>
        {erreur ? <Avis ton="alerte">{erreur}</Avis> : null}
        <form className="champ" style={{ gap: 12 }} onSubmit={lancer(() => actions.rejoindre(code))}>
          <h2>J'ai un code d'invitation</h2>
          <Champ libelle="Code" aide="Le gestionnaire le trouve dans Réglages → Inviter.">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="COP-XXXXXXXX" autoCapitalize="characters" autoComplete="off" required />
          </Champ>
          <button className="bouton large" disabled={occupe}>Rejoindre</button>
        </form>
        <div className="separateur">ou</div>
        <form className="champ" style={{ gap: 12 }} onSubmit={lancer(() => actions.creerCopro(nom.trim()))}>
          <h2>Créer une copropriété</h2>
          <Champ libelle="Nom" aide="Par exemple l'adresse de l'immeuble.">
            <input value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={60} />
          </Champ>
          <button className="bouton doux large" disabled={occupe}>Créer</button>
        </form>
        <button type="button" className="bouton texte" onClick={actions.deconnexion}>Se déconnecter</button>
      </div>
    </div>
  );
}
