import { useState } from 'react';
import { useSession } from '../donnees/Session';

/** Initiales d'un nom ou d'un courriel : « Camille Exemple » → « CE ». */
export const initiales = (texte) =>
  (texte || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '?';

/**
 * L'avatar de la barre du haut et son menu, comme dans Budget Maison : qui
 * est connecté, l'accès aux Réglages, la déconnexion.
 *
 * Les initiales sont toujours dessinées, la photo Google se pose par-dessus :
 * une photo qui ne répond pas laisserait sinon une pastille vide.
 */
export default function MenuProfil({ allerA }) {
  const { user, profil, copro, estGestionnaire, actions } = useSession();
  const [ouvert, setOuvert] = useState(false);
  const nom = copro?.members?.[user.uid]?.displayName || profil?.nom || user.displayName || user.email;
  const aller = (cle) => { setOuvert(false); allerA(cle); };
  return (
    <div className="menu-ancre">
      <button type="button" className="avatar-entete" onClick={() => setOuvert(!ouvert)} aria-haspopup="menu" aria-expanded={ouvert} aria-label="Menu du profil">
        <span aria-hidden="true">{initiales(nom)}</span>
        {user.photoURL ? (
          // no-referrer : la photo vient de Google, qui n'a pas à savoir d'où on la regarde.
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : null}
      </button>
      {ouvert ? (
        <>
          <div className="voile-menu" onClick={() => setOuvert(false)} />
          <div className="menu-deroulant" role="menu">
            <div className="menu-tete">
              <strong>{nom}</strong>
              <small className="discret">{user.email}</small>
              {estGestionnaire ? <span className="etiquette">Gestionnaire</span> : null}
            </div>
            <button type="button" role="menuitem" className="menu-item" onClick={() => aller('reglages:profil')}>Mon profil</button>
            <button type="button" role="menuitem" className="menu-item" onClick={() => aller('reglages:copropriete')}>Copropriétaires et invitation</button>
            <button type="button" role="menuitem" className="menu-item" onClick={() => aller('reglages:notifications')}>Notifications</button>
            <div className="menu-sep" />
            <button type="button" role="menuitem" className="menu-item danger" onClick={() => { setOuvert(false); actions.deconnexion(); }}>Se déconnecter</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
