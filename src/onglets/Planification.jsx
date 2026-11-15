import { useMemo, useState } from 'react';
import { useCopro } from '../donnees/Session';
import { planifier, premierMoisNegatif } from '../calc/budget';
import { moisDe, libelleMois, ajouterMois } from '../calc/mois';
import { dollars } from '../donnees/format';
import { nouvelId } from '../donnees/code';
import { Nombre, EntreesSorties } from '../composants/graphiques';
import { Feuille, Champ, ChampMontant, ChampMois, Segments, Icone, Avis, montantValide } from '../composants/ui';
import { lireMontant } from '../donnees/format';

function FeuilleSolde({ onFermer }) {
  const { copro, modifier } = useCopro();
  const [montant, setMontant] = useState(copro.solde ? String(copro.solde.montant).replace('.', ',') : '');
  const [mois, setMois] = useState(moisDe());
  const [erreur, setErreur] = useState('');
  const enregistrer = (e) => {
    e.preventDefault();
    // Un compte peut être à découvert : le solde négatif est permis ici.
    const n = lireMontant(montant);
    if (!Number.isFinite(n)) { setErreur('Entrez le solde du compte, en dollars.'); return; }
    modifier({ solde: { montant: Math.round(n * 100) / 100, mois } });
    onFermer();
  };
  return (
    <Feuille titre="Solde du compte" onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <ChampMontant libelle="Solde du compte de la copropriété" valeur={montant} onChange={setMontant} erreur={erreur} inputMode="text" />
        <ChampMois libelle="Au début de" valeur={mois} onChange={setMois}
          aide="Avant les loyers, les versements et les paiements de ce mois-là. La planification part de ce solde ; le ressaisir la recale." />
        <div className="pied">
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton">Enregistrer</button>
        </div>
      </form>
    </Feuille>
  );
}

function FeuilleAjustement({ ajustement, moisPropose, onFermer }) {
  const { copro, modifier } = useCopro();
  const nouveau = !ajustement;
  const [sens, setSens] = useState(ajustement && ajustement.montant > 0 ? 'entree' : 'sortie');
  const [libelle, setLibelle] = useState(ajustement?.libelle || '');
  const [montant, setMontant] = useState(ajustement ? String(Math.abs(ajustement.montant)).replace('.', ',') : '');
  const [mois, setMois] = useState(ajustement?.mois || moisPropose);
  const [erreur, setErreur] = useState('');

  const enregistrer = (e) => {
    e.preventDefault();
    const n = montantValide(montant);
    if (n === null) { setErreur('Entrez un montant plus grand que zéro.'); return; }
    const suivant = { id: ajustement?.id || nouvelId(), libelle: libelle.trim(), mois, montant: sens === 'entree' ? n : -n };
    modifier({ ajustements: nouveau ? [...copro.ajustements, suivant] : copro.ajustements.map((a) => (a.id === suivant.id ? suivant : a)) });
    onFermer();
  };
  const supprimer = () => {
    modifier({ ajustements: copro.ajustements.filter((a) => a.id !== ajustement.id) });
    onFermer();
  };

  return (
    <Feuille titre={nouveau ? 'Nouvel ajustement' : 'Ajustement'} onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <Segments libelle="Entrée ou sortie" valeur={sens} onChange={setSens}
          options={[{ valeur: 'sortie', libelle: 'Sortie d\'argent' }, { valeur: 'entree', libelle: 'Entrée d\'argent' }]} />
        <Champ libelle="Description">
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} required maxLength={50}
            placeholder={sens === 'entree' ? 'Remboursement d\'assurance' : 'Réparation imprévue'} />
        </Champ>
        <ChampMontant libelle="Montant" valeur={montant} onChange={setMontant} erreur={erreur} />
        <ChampMois libelle="Mois" valeur={mois} onChange={setMois}
          aide="Un ajustement touche le solde du compte ce mois-là, sans changer les versements." />
        <div className="pied">
          {!nouveau ? <button type="button" className="bouton danger gauche" onClick={supprimer}>Supprimer</button> : null}
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton">Enregistrer</button>
        </div>
      </form>
    </Feuille>
  );
}

/** Le solde de fin de mois, treize barres. Les mois sous zéro descendent en rouge. */
function Barres({ plan, choisi, onChoisir }) {
  const max = Math.max(1, ...plan.map((l) => l.soldeFin));
  const min = Math.min(0, ...plan.map((l) => l.soldeFin));
  const etendue = max - min;
  const zero = (max / etendue) * 100;
  return (
    <div className="barres" role="group" aria-label="Solde projeté à la fin de chaque mois">
      {plan.map((l, i) => {
        const hauteur = (Math.abs(l.soldeFin) / etendue) * 100;
        return (
          <button key={l.mois} type="button" className="colonne" onClick={() => onChoisir(l.mois)}
            aria-pressed={choisi === l.mois} aria-label={`${libelleMois(l.mois)} : ${dollars(l.soldeFin)}`}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', opacity: choisi && choisi !== l.mois ? 0.45 : 1, '--i': i }}>
            <span className="zone">
              <span className="zero" style={{ top: `${zero}%` }} />
              <span className={`barre-solde${l.soldeFin < 0 ? ' negatif' : ''}`}
                style={l.soldeFin < 0 ? { top: `${zero}%`, height: `${hauteur}%` } : { bottom: `${100 - zero}%`, height: `${hauteur}%` }} />
            </span>
            <span className="nom">{libelleMois(l.mois, { court: true, annee: false }).slice(0, 4)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Planification() {
  const { copro } = useCopro();
  const depart = moisDe();
  const plan = useMemo(() => planifier(copro, depart), [copro, depart]);
  const negatif = premierMoisNegatif(plan);
  const [choisi, setChoisi] = useState(depart);
  const [solde, setSolde] = useState(false);
  const [ajustement, setAjustement] = useState(undefined);
  const ligne = plan.find((l) => l.mois === choisi) || plan[0];
  const aVenir = copro.ajustements.filter((a) => a.mois >= depart).sort((a, b) => a.mois.localeCompare(b.mois));

  return (
    <>
      <div className="entete">
        <div><p className="discret">Le compte sur 13 mois</p></div>
        <button className="bouton" onClick={() => setAjustement(null)}><Icone nom="plus" taille={18} />Ajustement</button>
      </div>

      {!copro.solde ? (
        <Avis ton="attention">Le solde du compte n'a pas été saisi : la projection part de 0 $. <button className="bouton texte" onClick={() => setSolde(true)}>Saisir le solde</button></Avis>
      ) : null}
      {negatif ? <Avis ton="alerte">Le solde passe sous zéro en <strong>{libelleMois(negatif)}</strong>. Un versement de plus, ou une dépense amortie plutôt que payée d'un coup, l'éviterait.</Avis> : null}

      <section className="carte">
        <header>
          <h2>Solde à la fin de chaque mois</h2>
          <button className="bouton texte" onClick={() => setSolde(true)}>Solde</button>
        </header>
        <Barres plan={plan} choisi={choisi} onChoisir={setChoisi} />
        <p className="discret">Touchez un mois pour voir son détail.</p>
      </section>

      <section className="carte" aria-live="polite">
        <header><h2>{libelleMois(ligne.mois)}</h2></header>
        <div>
          <span className="discret">Solde à la fin du mois</span><br />
          <Nombre valeur={ligne.soldeFin} className={`total-geant ${ligne.soldeFin < 0 ? 'mauvais' : ''}`} />
        </div>
        <EntreesSorties nomEntrees="Entrées" entrees={ligne.revenus + ligne.versements + Math.max(0, ligne.totalAjustements)}
          sorties={ligne.depenses + ligne.hypotheque + Math.max(0, -ligne.totalAjustements)} />
        <div>
          <div className="ligne"><span>Solde au début</span><span className="chiffre">{dollars(ligne.soldeDebut)}</span></div>
          <div className="ligne"><span>Loyers</span><span className="chiffre bon">+ {dollars(ligne.revenus)}</span></div>
          <div className="ligne"><span>Versements des copropriétaires</span><span className="chiffre bon">+ {dollars(ligne.versements)}</span></div>
          <div className="ligne"><span>Dépenses payées ce mois-ci</span><span className="chiffre">− {dollars(ligne.depenses)}</span></div>
          <div className="ligne"><span>Hypothèque</span><span className="chiffre">− {dollars(ligne.hypotheque)}</span></div>
          {ligne.ajustements.map((a) => (
            <div className="ligne" key={a.id}><span>{a.libelle}</span><span className={`chiffre ${a.montant > 0 ? 'bon' : ''}`}>{a.montant > 0 ? '+' : '−'} {dollars(Math.abs(a.montant))}</span></div>
          ))}
          <div className="ligne total"><span>Solde à la fin</span><span className={`chiffre ${ligne.soldeFin < 0 ? 'mauvais' : ''}`}>{dollars(ligne.soldeFin)}</span></div>
        </div>
        <button className="bouton contour" onClick={() => setAjustement(null)}>Ajouter un ajustement en {libelleMois(ligne.mois)}</button>
      </section>

      {aVenir.length ? (
        <section className="carte">
          <header><h2>Ajustements à venir</h2></header>
          <div className="liste">
            {aVenir.map((a) => (
              <button className="element" key={a.id} onClick={() => setAjustement(a)}>
                <div className="corps"><strong>{a.libelle}</strong><span className="discret">{libelleMois(a.mois)}</span></div>
                <strong className={`chiffre ${a.montant > 0 ? 'bon' : ''}`}>{a.montant > 0 ? '+' : '−'} {dollars(Math.abs(a.montant))}</strong>
                <Icone nom="chevron" taille={18} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {solde ? <FeuilleSolde onFermer={() => setSolde(false)} /> : null}
      {ajustement !== undefined ? <FeuilleAjustement ajustement={ajustement} moisPropose={ligne.mois} onFermer={() => setAjustement(undefined)} /> : null}
    </>
  );
}
