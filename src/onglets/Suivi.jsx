import { useMemo, useState } from 'react';
import { useSession } from '../donnees/Session';
import { aConfirmer } from '../calc/suivi';
import { CATEGORIES } from '../calc/budget';
import { moisDe, libelleMois } from '../calc/mois';
import { dollars } from '../donnees/format';
import { nouvelId } from '../donnees/code';
import { Feuille, Champ, ChampMontant, Segments, Avis, Icone, Vide, montantValide, useToast } from '../composants/ui';
import { TuilePoste, posteDe } from '../composants/graphiques';
import PiecesJointes, { usePiecesJointes } from '../composants/PiecesJointes';
import RapportAnnuel from '../composants/RapportAnnuel';

const enTexte = (n) => (n === '' || n === null || n === undefined ? '' : String(n).replace('.', ','));
// Aujourd'hui pour un paiement du mois courant ; sinon le 1er du mois concerné.
const dateParDefaut = (mois) => (mois === moisDe() ? new Date().toLocaleDateString('en-CA') : `${mois}-01`);

/**
 * Confirmer un paiement : ce qui a vraiment été payé (ou reçu), quand, à qui,
 * avec la facture. C'est ce qui nourrit le rapport d'impôt.
 */
function FeuillePaiement({ attendu, paiement, onFermer }) {
  const { copro, actions } = useSession();
  const toast = useToast();
  // Trois cas : un paiement attendu par le budget, un paiement déjà confirmé
  // qu'on corrige, ou un paiement libre (hors budget) qu'on ajoute.
  const base = paiement || attendu || null;
  const libre = !base || base.source?.type === 'libre';
  const [id] = useState(base?.id || `libre-${nouvelId()}`);
  const [sens, setSens] = useState(base?.sens || 'sortie');
  const [libelle, setLibelle] = useState(base?.libelle || '');
  const [categorie, setCategorie] = useState(base?.categorie && base.categorie !== 'Loyer' && base.categorie !== 'Hypothèque' ? base.categorie : 'Entretien');
  const [montant, setMontant] = useState(enTexte(paiement?.montant ?? attendu?.prevu ?? ''));
  const [date, setDate] = useState(paiement?.date || dateParDefaut(base?.mois || moisDe()));
  const [fournisseur, setFournisseur] = useState(paiement?.fournisseur || '');
  const [tps, setTps] = useState(enTexte(paiement?.tps ?? ''));
  const [tvq, setTvq] = useState(enTexte(paiement?.tvq ?? ''));
  const [nature, setNature] = useState(paiement?.nature || attendu?.nature || 'courante');
  const [note, setNote] = useState(paiement?.note || '');
  const [erreur, setErreur] = useState('');
  const pieces = usePiecesJointes(copro.id, paiement?.pieces || []);
  const hypotheque = base?.source?.type === 'hypotheque';
  const entree = sens === 'entree';

  const enregistrer = (statut) => (e) => {
    e?.preventDefault();
    const m = montantValide(montant, { zeroPermis: statut === 'nonpaye' });
    if (statut === 'paye' && m === null) { setErreur('Entrez le montant réellement payé.'); return; }
    if (libre && !libelle.trim()) { setErreur('Décrivez le paiement.'); return; }
    const taxe = (t) => (t.trim() ? montantValide(t, { zeroPermis: true }) : null);
    const mois = (date || '').slice(0, 7) || base?.mois || moisDe();
    actions.enregistrerPaiement(copro.id, {
      id, statut, sens,
      source: base?.source || { type: 'libre', id },
      // Le mois d'un paiement attendu reste celui du budget, même payé en
      // retard ; un paiement libre prend le mois de sa date.
      mois: libre ? mois : base.mois,
      libelle: libre ? libelle.trim() : base.libelle,
      categorie: libre ? (entree ? 'Revenu' : categorie) : base.categorie,
      prevu: attendu?.prevu ?? paiement?.prevu ?? null,
      montant: statut === 'paye' ? m : 0,
      date: statut === 'paye' ? date : null,
      fournisseur: entree ? '' : fournisseur.trim(),
      tps: entree ? null : taxe(tps), tvq: entree ? null : taxe(tvq),
      nature: entree || hypotheque ? null : nature,
      // La part d'intérêts calculée pour ce mois : le rapport en a besoin.
      interet: hypotheque ? (paiement?.interet ?? attendu?.interet ?? null) : null,
      note: note.trim(),
      pieces: pieces.pieces,
    });
    pieces.valider();
    toast(statut === 'paye' ? (entree ? 'Reçu, noté.' : 'Paiement confirmé.') : 'Noté comme non payé.');
    onFermer();
  };

  const supprimer = () => {
    if (!window.confirm('Retirer cette confirmation ? Le paiement redeviendra « à confirmer » (s\'il était prévu au budget).')) return;
    for (const p of pieces.pieces) pieces.retirer(p);
    pieces.valider();
    actions.supprimerPaiement(copro.id, paiement.id);
    onFermer();
  };

  return (
    <Feuille titre={libre ? (paiement ? 'Paiement' : 'Nouveau paiement') : base.libelle} onFermer={onFermer}>
      <form onSubmit={enregistrer('paye')}>
        {!libre ? (
          <p className="discret">{libelleMois(base.mois)}{attendu || paiement?.prevu ? ` · prévu : ${dollars(attendu?.prevu ?? paiement.prevu)}` : ''}</p>
        ) : (
          <>
            <Segments libelle="Sortie ou entrée" valeur={sens} onChange={setSens}
              options={[{ valeur: 'sortie', libelle: 'Dépense payée' }, { valeur: 'entree', libelle: 'Revenu reçu' }]} />
            <Champ libelle="Description">
              <input value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={60} placeholder={entree ? 'Frais de retard du locataire' : 'Réparation du lave-vaisselle'} />
            </Champ>
            {!entree ? (
              <Champ libelle="Catégorie">
                <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Champ>
            ) : null}
          </>
        )}
        <div className="paire">
          <ChampMontant libelle={entree ? 'Montant reçu' : 'Montant payé'} valeur={montant} onChange={setMontant} aide={entree ? null : 'Taxes incluses.'} />
          <Champ libelle="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Champ>
        </div>
        {hypotheque && (attendu?.interet ?? paiement?.interet) !== null ? (
          <p className="discret">Dont intérêts calculés : {dollars(attendu?.interet ?? paiement.interet)}. Le relevé annuel du prêteur, saisi dans le rapport, fera foi.</p>
        ) : null}
        {!entree && !hypotheque ? (
          <>
            <Champ libelle="Fournisseur (facultatif)"><input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} maxLength={60} /></Champ>
            <div className="paire">
              <ChampMontant libelle="Dont TPS" valeur={tps} onChange={setTps} />
              <ChampMontant libelle="Dont TVQ" valeur={tvq} onChange={setTvq} />
            </div>
            <small className="discret">À titre d'information : en location résidentielle à long terme, la TPS et la TVQ payées ne se récupèrent pas ; elles font partie de la dépense.</small>
            <Segments libelle="Nature de la dépense" valeur={nature} onChange={setNature}
              options={[{ valeur: 'courante', libelle: 'Courante' }, { valeur: 'capital', libelle: 'En capital' }]} />
            <small className="discret">{nature === 'capital'
              ? 'En capital : un bien durable ou une amélioration (armoire neuve, toiture). Elle ne se déduit pas d\'un coup ; elle s\'amortit (DPA). Le rapport la liste à part.'
              : 'Courante : l\'entretien et les réparations qui remettent en état, et les frais de l\'année. Elle se déduit l\'année où elle est payée.'}</small>
          </>
        ) : null}
        <PiecesJointes coproId={copro.id} etat={pieces} libelle={entree ? 'Pièces jointes' : 'Facture ou reçu'} />
        <Champ libelle="Note (facultatif)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Champ>
        {erreur ? <Avis ton="alerte">{erreur}</Avis> : null}
        <div className="pied">
          {paiement ? <button type="button" className="bouton danger gauche" onClick={supprimer}>Retirer</button> : null}
          {!libre && !paiement ? <button type="button" className="bouton texte gauche" onClick={enregistrer('nonpaye')}>{entree ? 'Pas reçu' : 'Pas payé'}</button> : null}
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton">{entree ? 'Reçu' : 'Confirmer'}</button>
        </div>
      </form>
    </Feuille>
  );
}

function Ligne({ p, montant, sous, onClick, i }) {
  return (
    <button className="element" style={{ '--i': i }} onClick={onClick}>
      {p.sens === 'entree'
        ? <span className="tuile loyer" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" /></svg></span>
        : <TuilePoste poste={p.source?.type === 'hypotheque' ? 'Hypothèque' : posteDe(p.categorie)} />}
      <div className="corps"><strong>{p.libelle}</strong><span className="discret">{sous}</span></div>
      <div className="droite">
        <strong className={`chiffre ${p.sens === 'entree' ? 'bon' : ''}`}>{p.sens === 'entree' ? '+' : '−'} {dollars(montant)}</strong>
        {p.pieces?.length ? (
          <span className="pastille-pieces" aria-label={`${p.pieces.length} pièce(s) jointe(s)`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" /></svg>
            {p.pieces.length}
          </span>
        ) : null}
      </div>
      <Icone nom="chevron" taille={18} />
    </button>
  );
}

export default function Suivi() {
  const { copro, paiements } = useSession();
  const mois = moisDe();
  const attente = useMemo(() => aConfirmer(copro, paiements, mois), [copro, paiements, mois]);
  const [ouvert, setOuvert] = useState(undefined); // { attendu } | { paiement } | {} (libre)
  const [rapport, setRapport] = useState(false);
  const [tout, setTout] = useState(false);
  const confirmes = [...paiements].sort((a, b) => (b.date || b.mois).localeCompare(a.date || a.mois));
  const visibles = tout ? confirmes : confirmes.slice(0, 8);

  return (
    <>
      <div className="entete">
        <div><h1>Suivi</h1><p className="discret">Ce qui a vraiment été payé et reçu</p></div>
        <button className="bouton" onClick={() => setOuvert({})}><Icone nom="plus" taille={18} />Paiement</button>
      </div>

      <section className="carte">
        <header><h2>À confirmer</h2>{attente.length ? <span className="etiquette">{attente.length}</span> : null}</header>
        {attente.length ? (
          <>
            <p className="discret">Touchez un paiement pour noter le montant réel et joindre la facture. Le rapport d'impôt ne compte que ce qui est confirmé.</p>
            <div className="liste">
              {attente.slice(0, 30).map((a, i) => (
                <Ligne key={a.id} p={a} i={i} montant={a.prevu} sous={`${libelleMois(a.mois)} · prévu`} onClick={() => setOuvert({ attendu: a })} />
              ))}
            </div>
            {attente.length > 30 ? <p className="discret">Et {attente.length - 30} autres, plus récents.</p> : null}
          </>
        ) : <Vide titre="Tout est à jour" texte="Chaque loyer et chaque paiement prévu jusqu'à ce mois-ci a été confirmé." />}
      </section>

      <section className="carte">
        <header><h2>Confirmés</h2></header>
        {confirmes.length ? (
          <>
            <div className="liste">
              {visibles.map((p, i) => (
                <Ligne key={p.id} p={p} i={i} montant={p.statut === 'paye' ? p.montant : p.prevu}
                  sous={p.statut === 'paye' ? `${p.date || libelleMois(p.mois)}${p.fournisseur ? ` · ${p.fournisseur}` : ''}` : `${libelleMois(p.mois)} · ${p.sens === 'entree' ? 'pas reçu' : 'pas payé'}`}
                  onClick={() => setOuvert({ paiement: p })} />
              ))}
            </div>
            {confirmes.length > 8 ? <button className="bouton texte" onClick={() => setTout(!tout)}>{tout ? 'Moins' : `Tout voir (${confirmes.length})`}</button> : null}
          </>
        ) : <p className="discret">Rien de confirmé encore.</p>}
      </section>

      <section className="carte">
        <header><h2>Rapport annuel</h2></header>
        <p className="discret">Revenus et dépenses de l'année, classés selon l'état des loyers (T776, TP-128), avec la part de chaque propriétaire. À imprimer en PDF ou à exporter pour le comptable.</p>
        <button className="bouton doux" onClick={() => setRapport(true)}>Ouvrir le rapport</button>
      </section>

      {ouvert !== undefined ? <FeuillePaiement attendu={ouvert.attendu} paiement={ouvert.paiement} onFermer={() => setOuvert(undefined)} /> : null}
      {rapport ? <RapportAnnuel onFermer={() => setRapport(false)} /> : null}
    </>
  );
}
