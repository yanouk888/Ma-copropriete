import { useEffect, useRef, useState } from 'react';
import { envoyerFichier, ouvrirFichier, supprimerFichier, TYPES_ACCEPTES, taillelisible } from '../donnees/fichiers';
import { useToast } from './ui';

/**
 * Les pièces jointes d'une chose (paiement, dépense, logement) : la liste,
 * les ouvrir, en ajouter, en retirer.
 *
 * Les fichiers partent au NAS dès qu'on les choisit, mais la liste n'est
 * enregistrée qu'avec le reste du formulaire. Si l'on annule, les fichiers
 * envoyés pendant cette ouverture sont effacés du NAS : sinon ils y
 * resteraient, orphelins, sans rien qui les mentionne.
 */
export function usePiecesJointes(coproId, initiales = []) {
  const [pieces, setPieces] = useState(initiales);
  const nouvelles = useRef([]);
  const retirees = useRef([]);
  const valide = useRef(false);
  useEffect(() => () => {
    if (!valide.current) for (const p of nouvelles.current) supprimerFichier(coproId, p).catch(() => {});
  }, [coproId]);
  return {
    pieces,
    ajouter: (p) => { nouvelles.current.push(p); setPieces((l) => [...l, p]); },
    retirer: (p) => { retirees.current.push(p); setPieces((l) => l.filter((x) => x.id !== p.id)); },
    /** À appeler quand le formulaire est enregistré : les retirées partent du NAS, les nouvelles y restent. */
    valider: () => {
      valide.current = true;
      for (const p of retirees.current) supprimerFichier(coproId, p).catch(() => {});
    },
  };
}

export default function PiecesJointes({ coproId, etat, libelle = 'Pièces jointes', aide }) {
  const toast = useToast();
  const champ = useRef(null);
  const [envoi, setEnvoi] = useState(0);

  const choisir = async (e) => {
    const fichiers = [...e.target.files];
    e.target.value = '';
    for (const f of fichiers) {
      setEnvoi((n) => n + 1);
      try { etat.ajouter(await envoyerFichier(coproId, f)); } catch (err) { toast(`${f.name} : ${err.message}`); } finally { setEnvoi((n) => n - 1); }
    }
  };
  const ouvrir = async (p) => { try { await ouvrirFichier(coproId, p); } catch (err) { toast(err.message); } };

  return (
    <div className="champ pieces">
      <span>{libelle}</span>
      {etat.pieces.length ? (
        <ul className="liste-pieces">
          {etat.pieces.map((p) => (
            <li key={p.id}>
              <button type="button" className="piece" onClick={() => ouvrir(p)}>
                <span className="piece-type" aria-hidden="true">{p.type === 'application/pdf' ? 'PDF' : 'IMG'}</span>
                <span className="piece-nom">{p.nom}</span>
                <span className="discret chiffre">{taillelisible(p.taille)}</span>
              </button>
              <button type="button" className="icone-bouton" aria-label={`Retirer ${p.nom}`} onClick={() => etat.retirer(p)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input ref={champ} type="file" accept={TYPES_ACCEPTES} multiple hidden onChange={choisir} />
      <button type="button" className="bouton contour" onClick={() => champ.current.click()} disabled={envoi > 0}>
        {envoi > 0 ? 'Envoi…' : 'Joindre un PDF ou une photo'}
      </button>
      {aide ? <small>{aide}</small> : null}
    </div>
  );
}
