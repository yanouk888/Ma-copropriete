import { useSession } from '../donnees/Session';
import NouvelleCopro from '../composants/NouvelleCopro';
import BarreDuHaut from '../composants/BarreDuHaut';
import MenuProfil from '../composants/MenuProfil';
import Logo from '../composants/Logo';

/**
 * Connecté, sans propriété : on est quand même dans l'application, avec sa
 * cloche et son avatar. Un code reçu ou une création, maintenant ou plus
 * tard — l'inscription ne demande pas de code.
 */
export default function Bienvenue() {
  const { user, profil } = useSession();
  const prenom = profil?.nom || user.displayName;
  return (
    <>
      <BarreDuHaut>
        <span className="titre-page">
          <Logo taille={36} />
          <span className="titre-page-textes"><span className="titre-page-nom">Mes copropriétés</span></span>
        </span>
        <MenuProfil />
      </BarreDuHaut>
      <main className="page">
        <section className="carte">
          <div>
            <h1>Bonjour{prenom ? `, ${prenom}` : ''}</h1>
            <p className="discret">Aucune propriété pour l'instant. Entrez le code reçu d'un copropriétaire, ou créez la vôtre — maintenant ou plus tard.</p>
          </div>
          <NouvelleCopro />
        </section>
      </main>
    </>
  );
}
