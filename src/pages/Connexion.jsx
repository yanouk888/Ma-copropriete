import { useState } from 'react';
import { useSession, messageErreur } from '../donnees/Session';
import { Champ, Segments, Avis, useToast } from '../composants/ui';

export default function Connexion() {
  const { actions } = useSession();
  const toast = useToast();
  // Arrivé par une invitation : on propose d'emblée de créer un compte, et on
  // dit pourquoi on est là. Le code reste dans l'adresse jusqu'à l'accueil.
  const invite = new URLSearchParams(window.location.search).get('code');
  const [mode, setMode] = useState(invite ? 'inscription' : 'connexion');
  const [nom, setNom] = useState('');
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const lancer = async (geste) => {
    setErreur('');
    setOccupe(true);
    try { await geste(); } catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(false); }
  };

  const soumettre = (e) => {
    e.preventDefault();
    lancer(() => (mode === 'connexion'
      ? actions.connexion(courriel.trim(), motDePasse)
      : actions.inscription(nom.trim(), courriel.trim(), motDePasse)));
  };

  const oublie = () => {
    if (!courriel.trim()) { setErreur('Entrez d\'abord votre courriel, puis touchez de nouveau « Mot de passe oublié ».'); return; }
    lancer(async () => {
      await actions.motDePasseOublie(courriel.trim());
      toast('Si un compte existe pour ce courriel, un lien de réinitialisation vient d\'y être envoyé.');
    });
  };

  return (
    <div className="centre">
      <form className="carte" onSubmit={soumettre}>
        <div className="vitrine">
          <h1>Ma copropriété</h1>
          <p>Le budget d'une copropriété locative, à plusieurs.</p>
          {/* Trois immeubles qui se bâtissent, puis leurs fenêtres qui s'allument : purement décoratif. */}
          <svg viewBox="0 0 320 110" aria-hidden="true">
            <rect className="immeuble" x="18" y="46" width="78" height="64" rx="4" />
            <rect className="immeuble" x="110" y="14" width="96" height="96" rx="4" />
            <rect className="immeuble" x="220" y="38" width="82" height="72" rx="4" />
            {[[30, 58], [52, 58], [74, 58], [30, 80], [74, 80],
              [124, 28], [148, 28], [172, 28], [124, 52], [172, 52], [124, 76], [148, 76],
              [234, 50], [258, 50], [282, 50], [234, 74], [282, 74]].map(([x, y], i) => (
              <rect key={i} className="fenetre" x={x} y={y} width="12" height="14" rx="2" style={{ '--i': i }} />
            ))}
          </svg>
        </div>
        {invite ? <Avis ton="info">Vous avez été invité dans une copropriété. Créez votre compte (ou connectez-vous) : le code sera déjà rempli.</Avis> : null}
        {/* Google d'abord : un seul toucher, et le bouton reste visible sans
            défiler sur un petit écran — tout en bas, on ne le voyait pas. */}
        <button type="button" className="bouton contour large bouton-google" disabled={occupe} onClick={() => lancer(actions.google)}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
          Continuer avec Google
        </button>
        <div className="separateur">ou avec votre courriel</div>
        <Segments libelle="Connexion ou inscription" valeur={mode} onChange={(m) => { setMode(m); setErreur(''); }}
          options={[{ valeur: 'connexion', libelle: 'Se connecter' }, { valeur: 'inscription', libelle: 'Créer un compte' }]} />
        {mode === 'inscription' ? (
          <Champ libelle="Votre prénom">
            <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="given-name" required maxLength={40} />
          </Champ>
        ) : null}
        <Champ libelle="Courriel">
          <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} autoComplete="email" required />
        </Champ>
        <Champ libelle="Mot de passe" aide={mode === 'inscription' ? 'Au moins 6 caractères.' : null}>
          <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'} required minLength={6} />
        </Champ>
        {erreur ? <Avis ton="alerte">{erreur}</Avis> : null}
        <button className="bouton large" disabled={occupe}>{mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}</button>
        {mode === 'connexion' ? <button type="button" className="bouton texte" onClick={oublie} disabled={occupe}>Mot de passe oublié</button> : null}
      </form>
    </div>
  );
}
