import { useState } from 'react';
import { useSession, messageErreur } from '../donnees/Session';
import { Champ, Segments, Avis, useToast } from '../composants/ui';

export default function Connexion() {
  const { actions } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState('connexion');
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
        <div className="separateur">ou</div>
        <button type="button" className="bouton contour large" disabled={occupe} onClick={() => lancer(actions.google)}>Continuer avec Google</button>
      </form>
    </div>
  );
}
