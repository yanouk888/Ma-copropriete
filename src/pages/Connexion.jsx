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
        <div className="marque">
          <img src="/favicon.svg" alt="" />
          <div>
            <h1>Ma copropriété</h1>
            <p className="discret">Le budget d'une copropriété locative, à plusieurs.</p>
          </div>
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
