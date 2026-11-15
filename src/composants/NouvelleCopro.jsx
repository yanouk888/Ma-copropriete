import { useState } from 'react';
import { useSession, messageErreur } from '../donnees/Session';
import { Champ, ChampMontant, Avis, montantValide } from './ui';

/**
 * Rejoindre avec un code, ou créer une copropriété. Le même formulaire sert à
 * l'accueil, quand on n'en a encore aucune, et dans « Mes copropriétés »,
 * pour en ajouter une autre — avec d'autres co-investisseurs.
 */
export default function NouvelleCopro({ apres }) {
  const { actions } = useSession();
  const [nom, setNom] = useState('');
  const [loyer, setLoyer] = useState('');
  // Arrivé par le bouton d'un courriel d'invitation : le code est dans l'adresse.
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const lancer = (geste) => async (e) => {
    e.preventDefault();
    setErreur('');
    setOccupe(true);
    try { await geste(); apres?.(); } catch (err) {
      // Les règles refusent un code périmé par « permission-denied » : dit
      // tel quel, on croirait à une panne.
      setErreur(err?.code === 'permission-denied' ? 'Ce code n\'est plus valide. Demandez-en un nouveau au gestionnaire.' : messageErreur(err));
    } finally { setOccupe(false); }
  };

  const creer = () => {
    // Le loyer est facultatif : vide, le logement est créé à 0 $ et se règle ensuite.
    const montant = loyer.trim() ? montantValide(loyer, { zeroPermis: true }) : 0;
    if (montant === null) throw new Error('Le loyer doit être un montant en dollars, ou rester vide.');
    return actions.creerCopro(nom.trim(), montant);
  };

  return (
    <>
      {erreur ? <Avis ton="alerte">{erreur}</Avis> : null}
      <form className="champ" style={{ gap: 12 }} onSubmit={lancer(() => actions.rejoindre(code))}>
        <h2>J'ai un code d'invitation</h2>
        <Champ libelle="Code" aide="Le gestionnaire le trouve dans Réglages → Inviter.">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="COP-XXXXXXXX" autoCapitalize="characters" autoComplete="off" required />
        </Champ>
        <button className="bouton large" disabled={occupe}>Rejoindre</button>
      </form>
      <div className="separateur">ou</div>
      <form className="champ" style={{ gap: 12 }} onSubmit={lancer(creer)}>
        <h2>Créer une copropriété</h2>
        <Champ libelle="Adresse de l'immeuble" aide="Elle sert aussi de nom au premier logement ; vous pourrez en ajouter d'autres.">
          <input value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={60} placeholder="12, rue des Érables" />
        </Champ>
        <ChampMontant libelle="Loyer mensuel (facultatif)" valeur={loyer} onChange={setLoyer} />
        <button className="bouton doux large" disabled={occupe}>Créer</button>
      </form>
    </>
  );
}
