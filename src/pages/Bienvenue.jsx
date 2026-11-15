import { useSession } from '../donnees/Session';
import NouvelleCopro from '../composants/NouvelleCopro';

/** Premier écran après la connexion : on n'a pas encore de copropriété. */
export default function Bienvenue() {
  const { user, profil, actions } = useSession();
  const prenom = profil?.nom || user.displayName;
  return (
    <div className="centre">
      <div className="carte">
        <div>
          <h1>Bonjour{prenom ? `, ${prenom}` : ''}</h1>
          <p className="discret">Rejoignez une copropriété existante, ou créez la vôtre.</p>
        </div>
        <NouvelleCopro />
        <button type="button" className="bouton texte" onClick={actions.deconnexion}>Se déconnecter</button>
      </div>
    </div>
  );
}
