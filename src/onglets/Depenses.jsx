import { useMemo, useState } from 'react';
import { useCopro } from '../donnees/Session';
import {
  FREQUENCES, FREQUENCES_VERSEMENTS, CATEGORIES, mensualiteDepense, montantEnVigueur, poserPalier,
  montantDuVersement, rangVersement, dernierVersement,
  deroulerHypotheque, mensualiteHypotheque, resumeDuMois,
} from '../calc/budget';
import { moisDe, libelleMois, ajouterMois, ecartMois } from '../calc/mois';
import { dollars } from '../donnees/format';
import { nouvelId } from '../donnees/code';
import PiecesJointes, { usePiecesJointes } from '../composants/PiecesJointes';
import { Nombre, Repartition, TuilePoste, postesDuMois, posteDe } from '../composants/graphiques';
import { Feuille, Champ, ChampMontant, ChampMois, Segments, Bascule, Icone, Vide, Avis, montantValide } from '../composants/ui';

const enTexte = (n) => (n === '' || n === null || n === undefined ? '' : String(n).replace('.', ','));

function FeuilleDepense({ depense, onFermer }) {
  const { copro, modifier } = useCopro();
  const mois = moisDe();
  const nouveau = !depense;
  const montantActuel = depense
    ? depense.type !== 'recurrente' ? depense.montant : montantEnVigueur(depense.paliers, mois) ?? depense.paliers[0].montant
    : '';
  const [type, setType] = useState(depense?.type || 'recurrente');
  const [nom, setNom] = useState(depense?.nom || '');
  const [categorie, setCategorie] = useState(depense?.categorie || CATEGORIES[0]);
  const [montant, setMontant] = useState(enTexte(montantActuel));
  const [frequence, setFrequence] = useState(depense?.frequence || 'mensuel');
  const [depuis, setDepuis] = useState(mois);
  const [repere, setRepere] = useState(depense?.moisRepere || mois);
  const [terminee, setTerminee] = useState(Boolean(depense?.fin));
  const [fin, setFin] = useState(depense?.fin || mois);
  const [moisPaiement, setMoisPaiement] = useState(depense?.mois || ajouterMois(mois, 1));
  const [amortie, setAmortie] = useState(depense?.amortie ?? true);
  const [nombreVersements, setNombreVersements] = useState(depense?.nombre ? String(depense.nombre) : '');
  const [premier, setPremier] = useState(depense?.premier || mois);
  const [nature, setNature] = useState(depense?.nature || (depense?.type === 'versements' ? 'capital' : 'courante'));
  const pieces = usePiecesJointes(copro.id, depense?.pieces || []);
  const [erreur, setErreur] = useState('');

  const valeur = montantValide(montant);
  const montantChange = nouveau || valeur !== Number(montantActuel);
  const aDate = frequence === 'annuel' || frequence === 'trimestriel';
  // L'amortissement finit le mois du paiement quand il est assez loin ; sinon
  // il commence maintenant et se poursuit après, le temps de renflouer le compte.
  const amortDebut = ecartMois(mois, moisPaiement) >= 11 ? ajouterMois(moisPaiement, -11) : mois < moisPaiement ? mois : moisPaiement;

  const enregistrer = (e) => {
    e.preventDefault();
    if (valeur === null) { setErreur('Entrez un montant plus grand que zéro.'); return; }
    // La nature et les pièces jointes (contrat, soumission) suivent la dépense,
    // quel que soit son type ; la nature est reprise par le suivi des paiements.
    const base = { id: depense?.id || nouvelId(), nom: nom.trim(), categorie, type, nature, pieces: pieces.pieces };
    let suivante;
    if (type === 'versements') {
      const n = Number(nombreVersements);
      if (!Number.isInteger(n) || n < 2 || n > 600) { setErreur('Le nombre de versements est un nombre entier, de 2 à 600.'); return; }
      suivante = { ...base, montant: valeur, nombre: n, frequence: FREQUENCES_VERSEMENTS.includes(frequence) ? frequence : 'mensuel', premier };
    } else if (type === 'ponctuelle') {
      suivante = {
        ...base, montant: valeur, mois: moisPaiement, amortie,
        // Le début d'amortissement d'une dépense existante ne bouge que si son
        // mois change : sinon chaque retouche du nom relancerait les douze mois.
        amortDebut: !nouveau && depense.mois === moisPaiement && depense.amortDebut ? depense.amortDebut : amortDebut,
      };
    } else {
      let paliers = nouveau ? [{ depuis, montant: valeur }] : montantChange ? poserPalier(depense.paliers, depuis, valeur) : depense.paliers;
      if (!paliers.length) paliers = [{ depuis, montant: valeur }];
      suivante = { ...base, frequence, paliers, moisRepere: aDate ? repere : null, fin: terminee ? fin : null };
    }
    modifier({ depenses: nouveau ? [...copro.depenses, suivante] : copro.depenses.map((d) => (d.id === suivante.id ? suivante : d)) });
    pieces.valider();
    onFermer();
  };

  const supprimer = () => {
    if (!window.confirm(`Supprimer « ${depense.nom} » ? Pour qu'elle cesse sans perdre son historique, donnez-lui plutôt une date de fin.`)) return;
    modifier({ depenses: copro.depenses.filter((d) => d.id !== depense.id) });
    onFermer();
  };

  return (
    <Feuille titre={nouveau ? 'Nouvelle dépense' : depense.nom} onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        {nouveau ? (
          <Segments libelle="Type de dépense" valeur={type} onChange={setType}
            options={[{ valeur: 'recurrente', libelle: 'Récurrente' }, { valeur: 'ponctuelle', libelle: 'Ponctuelle' }, { valeur: 'versements', libelle: 'Versements' }]} />
        ) : null}
        <Champ libelle="Nom">
          <input value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={50}
            placeholder={type === 'ponctuelle' ? 'Remplacement du chauffe-eau' : type === 'versements' ? 'Armoire de cuisine' : 'Taxes municipales'} />
        </Champ>
        <Champ libelle="Catégorie">
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Champ>
        <ChampMontant libelle={type === 'ponctuelle' ? 'Montant' : type === 'versements' ? 'Montant total' : 'Montant de chaque paiement'} valeur={montant} onChange={setMontant} erreur={erreur} />

        {type === 'versements' ? (
          <>
            <div className="paire">
              <Champ libelle="Nombre de versements">
                <input type="text" inputMode="numeric" value={nombreVersements} onChange={(e) => setNombreVersements(e.target.value.replace(/\D/g, ''))} placeholder="36" required />
              </Champ>
              <Champ libelle="Fréquence">
                <select value={FREQUENCES_VERSEMENTS.includes(frequence) ? frequence : 'mensuel'} onChange={(e) => setFrequence(e.target.value)}>
                  {FREQUENCES_VERSEMENTS.map((f) => <option key={f} value={f}>{FREQUENCES[f].libelle}</option>)}
                </select>
              </Champ>
            </div>
            <ChampMois libelle="Premier versement" valeur={premier} onChange={setPremier} />
            {/* Ce que donne la saisie, avant d'enregistrer : la mensualité et le dernier versement. */}
            {valeur && Number(nombreVersements) >= 2 ? (() => {
              const essai = { montant: valeur, nombre: Number(nombreVersements), frequence: FREQUENCES_VERSEMENTS.includes(frequence) ? frequence : 'mensuel', premier };
              return <Avis ton="info">{nombreVersements} versements de <strong>{dollars(montantDuVersement(essai))}</strong>, le dernier en {libelleMois(dernierVersement(essai))}. Ensuite, la dépense s'arrête seule.</Avis>;
            })() : null}
          </>
        ) : type === 'recurrente' ? (
          <>
            <Champ libelle="Fréquence">
              <select value={frequence} onChange={(e) => setFrequence(e.target.value)}>
                {Object.entries(FREQUENCES).map(([cle, f]) => <option key={cle} value={cle}>{f.libelle}</option>)}
              </select>
            </Champ>
            {aDate ? (
              <ChampMois libelle={frequence === 'annuel' ? 'Mois du paiement' : 'Mois d\'un des paiements'} valeur={repere} onChange={setRepere}
                aide="Le fonds de roulement met le montant de côté peu à peu ; la planification le sort du compte ce mois-là." />
            ) : null}
            {montantChange ? (
              <ChampMois libelle={nouveau ? 'À partir de' : 'Nouveau montant à partir de'} valeur={depuis} onChange={setDepuis}
                aide={nouveau ? null : 'Les mois d\'avant gardent l\'ancien montant. Choisissez un mois à venir pour planifier un changement.'} />
            ) : null}
            {!nouveau && depense.paliers.length > 1 ? (
              <details>
                <summary>Historique des montants</summary>
                {depense.paliers.map((p) => (
                  <div className="ligne" key={p.depuis}><span>Depuis {libelleMois(p.depuis)}</span><span className="chiffre">{dollars(p.montant)}</span></div>
                ))}
              </details>
            ) : null}
            <Bascule libelle="Cette dépense prend fin" coche={terminee} onChange={setTerminee} />
            {terminee ? <ChampMois libelle="Dernier mois" valeur={fin} onChange={setFin} /> : null}
          </>
        ) : (
          <>
            <ChampMois libelle="Mois du paiement" valeur={moisPaiement} onChange={setMoisPaiement} />
            <Bascule libelle="Amortir sur 12 mois" coche={amortie} onChange={setAmortie}
              aide={amortie && valeur
                ? `${dollars(valeur / 12)} par mois dans le fonds de roulement, de ${libelleMois(amortDebut)} à ${libelleMois(ajouterMois(amortDebut, 11))}.`
                : 'Sinon, elle se paie à même le solde du compte, sans toucher aux versements.'} />
          </>
        )}
        <Segments libelle="Nature de la dépense" valeur={nature} onChange={setNature}
          options={[{ valeur: 'courante', libelle: 'Courante' }, { valeur: 'capital', libelle: 'En capital' }]} />
        <small className="discret">Pour l'impôt : une dépense en capital (bien durable, amélioration) s'amortit au lieu de se déduire d'un coup. Proposée à chaque confirmation de paiement, et modifiable là.</small>
        <PiecesJointes coproId={copro.id} etat={pieces} libelle="Documents (contrat, soumission)" />
        <div className="pied">
          {!nouveau ? <button type="button" className="bouton danger gauche" onClick={supprimer}>Supprimer</button> : null}
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton">Enregistrer</button>
        </div>
      </form>
    </Feuille>
  );
}

function FeuilleHypotheque({ onFermer }) {
  const { copro, modifier } = useCopro();
  const h = copro.hypotheque;
  const mois = moisDe();
  // Le solde proposé est celui d'aujourd'hui d'après le calcul, pas celui de
  // la dernière saisie : rouvrir la fenêtre ne doit pas ramener le prêt en arrière.
  const soldeCalcule = h ? deroulerHypotheque(h, mois).get(ajouterMois(mois, -1))?.solde ?? h.solde : '';
  const [solde, setSolde] = useState(enTexte(soldeCalcule));
  const [taux, setTaux] = useState(enTexte(h?.taux ?? ''));
  const [paiement, setPaiement] = useState(enTexte(h?.paiement ?? ''));
  const [frequence, setFrequence] = useState(h?.frequence || 'mensuel');
  const [renouvellement, setRenouvellement] = useState(h?.renouvellement || '');
  const [erreur, setErreur] = useState('');

  const enregistrer = (e) => {
    e.preventDefault();
    const s = montantValide(solde);
    const p = montantValide(paiement);
    const t = montantValide(taux, { zeroPermis: true });
    if (s === null || p === null || t === null || t > 25) { setErreur('Vérifiez le solde, le taux (en %) et le paiement.'); return; }
    modifier({ hypotheque: { solde: s, dateSolde: mois, taux: t, paiement: p, frequence, renouvellement: renouvellement || null } });
    onFermer();
  };

  const retirer = () => {
    if (!window.confirm('Retirer l\'hypothèque du budget ?')) return;
    modifier({ hypotheque: null });
    onFermer();
  };

  return (
    <Feuille titre="Hypothèque" onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <ChampMontant libelle={`Solde au début de ${libelleMois(mois)}`} valeur={solde} onChange={setSolde}
          aide="Tel qu'il paraît sur le relevé du prêteur. Le ressaisir de temps en temps recale le calcul." />
        <div className="paire">
          <ChampMontant libelle="Taux annuel (%)" valeur={taux} onChange={setTaux} />
          <ChampMontant libelle="Paiement" valeur={paiement} onChange={setPaiement} />
        </div>
        <Champ libelle="Fréquence du paiement">
          <select value={frequence} onChange={(e) => setFrequence(e.target.value)}>
            {['hebdo', 'aux2semaines', 'mensuel'].map((f) => <option key={f} value={f}>{FREQUENCES[f].libelle}</option>)}
          </select>
        </Champ>
        <Champ libelle="Date de renouvellement (facultatif)" aide="Un rappel est envoyé 90, 30 et 7 jours avant.">
          <input type="date" value={renouvellement} onChange={(e) => setRenouvellement(e.target.value)} />
        </Champ>
        {erreur ? <Avis ton="alerte">{erreur}</Avis> : null}
        <div className="pied">
          {h ? <button type="button" className="bouton danger gauche" onClick={retirer}>Retirer</button> : null}
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton">Enregistrer</button>
        </div>
      </form>
    </Feuille>
  );
}

export default function Depenses() {
  const { copro } = useCopro();
  const mois = moisDe();
  const [ouverte, setOuverte] = useState(undefined);
  const [hypotheque, setHypotheque] = useState(false);
  const resume = useMemo(() => resumeDuMois(copro, mois), [copro, mois]);
  const h = copro.hypotheque;
  const ligne = h ? deroulerHypotheque(h, mois).get(mois) : null;

  // Récurrentes d'abord, de la plus lourde à la plus légère : ce qui pèse le
  // plus dans le fonds se voit en premier.
  const recurrentes = copro.depenses.filter((d) => d.type === 'recurrente' || !d.type)
    .sort((a, b) => mensualiteDepense(b, mois) - mensualiteDepense(a, mois));
  const ponctuelles = copro.depenses.filter((d) => d.type === 'ponctuelle').sort((a, b) => a.mois.localeCompare(b.mois));
  const enVersements = copro.depenses.filter((d) => d.type === 'versements').sort((a, b) => a.premier.localeCompare(b.premier));

  const sousTitre = (d) => {
    if (d.fin && mois > d.fin) return `Terminée depuis ${libelleMois(ajouterMois(d.fin, 1))}`;
    const actuel = montantEnVigueur(d.paliers, mois);
    if (actuel === null) return `À partir de ${libelleMois(d.paliers[0].depuis)}`;
    const suivant = d.paliers.find((p) => p.depuis > mois);
    const base = `${dollars(actuel)} · ${FREQUENCES[d.frequence].libelle.toLowerCase()}`;
    return suivant ? `${base} · ${dollars(suivant.montant)} dès ${libelleMois(suivant.depuis, { court: true })}` : base;
  };

  return (
    <>
      <div className="entete">
        <div><h1>Dépenses</h1><p className="discret">Ce que la copropriété coûte</p></div>
        <button className="bouton" onClick={() => setOuverte(null)}><Icone nom="plus" taille={18} />Dépense</button>
      </div>

      <section className="carte">
        <span className="discret">Fonds de roulement, par mois</span>
        <Nombre valeur={resume.sorties} className="total-geant" />
        <Repartition postes={postesDuMois(copro, mois, resume.hypotheque)} />
        <p className="discret">Ce qu'il faut chaque mois pour tout payer, les dépenses annuelles et amorties ramenées au mois.</p>
      </section>

      <section className="carte">
        <header>
          <h2>Hypothèque</h2>
          <button className="bouton texte" onClick={() => setHypotheque(true)}>{h ? 'Modifier' : 'Ajouter'}</button>
        </header>
        {h && ligne ? (
          <div>
            <div className="element" style={{ cursor: 'default', paddingTop: 0 }}>
              <TuilePoste poste="Hypothèque" />
              <div className="corps"><strong>Paiement, ramené au mois</strong><span className="discret">Taux de {String(h.taux).replace('.', ',')} %</span></div>
              <strong><Nombre valeur={mensualiteHypotheque(h)} /></strong>
            </div>
            {/* Deux chiffres, pas un graphique : à deux parts, le nombre dit tout. */}
            <div className="duo" style={{ marginBottom: 12 }}>
              <div className="stat"><span>Intérêts ce mois-ci</span><strong><Nombre valeur={ligne.interet} /></strong></div>
              <div className="stat"><span>Capital remboursé</span><strong><Nombre valeur={ligne.capital} /></strong></div>
            </div>
            <div className="ligne"><span>Solde à la fin de {libelleMois(mois)}</span><span className="chiffre">{dollars(ligne.solde)}</span></div>
            {h.renouvellement ? <div className="ligne"><span>Renouvellement</span><span className="chiffre">{new Date(`${h.renouvellement}T12:00:00`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div> : null}
          </div>
        ) : <p className="discret">Aucune hypothèque saisie.</p>}
      </section>

      <section className="carte">
        <header><h2>Récurrentes</h2></header>
        {recurrentes.length ? (
          <div className="liste">
            {recurrentes.map((d, i) => (
              <button className="element" key={d.id} style={{ '--i': i }} onClick={() => setOuverte(d)}>
                <TuilePoste poste={posteDe(d.categorie)} />
                <div className="corps"><strong>{d.nom}</strong><span className="discret">{sousTitre(d)}</span></div>
                <div className="droite"><strong className="chiffre">{dollars(mensualiteDepense(d, mois))}</strong><span className="discret">par mois</span></div>
                <Icone nom="chevron" taille={18} />
              </button>
            ))}
          </div>
        ) : (
          <Vide titre="Aucune dépense récurrente" texte="Frais de condo, taxes, assurances, énergie : tout ce qui revient."
            action={<button className="bouton" onClick={() => setOuverte(null)}>Ajouter une dépense</button>} />
        )}
      </section>

      {ponctuelles.length ? (
        <section className="carte">
          <header><h2>Ponctuelles</h2></header>
          <div className="liste">
            {ponctuelles.map((d, i) => (
              <button className="element" key={d.id} style={{ '--i': i }} onClick={() => setOuverte(d)}>
                <TuilePoste poste={posteDe(d.categorie)} />
                <div className="corps">
                  <strong>{d.nom}</strong>
                  <span className="discret">{dollars(d.montant)} en {libelleMois(d.mois)} · {d.amortie ? `amortie jusqu'en ${libelleMois(ajouterMois(d.amortDebut, 11), { court: true })}` : 'payée à même le compte'}</span>
                </div>
                <div className="droite"><strong className="chiffre">{dollars(mensualiteDepense(d, mois))}</strong><span className="discret">par mois</span></div>
                <Icone nom="chevron" taille={18} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {enVersements.length ? (
        <section className="carte">
          <header><h2>En versements</h2></header>
          <div className="liste">
            {enVersements.map((d, i) => {
              const rang = rangVersement(d, mois);
              const fin = dernierVersement(d);
              return (
                <button className="element" key={d.id} style={{ '--i': i }} onClick={() => setOuverte(d)}>
                  <TuilePoste poste={posteDe(d.categorie)} />
                  <div className="corps">
                    <strong>{d.nom}</strong>
                    <span className="discret">
                      {dollars(d.montant)} en {d.nombre} versements · {mois < d.premier ? `dès ${libelleMois(d.premier, { court: true })}`
                        : mois > fin ? 'payé' : rang ? `versement ${rang.rang} sur ${rang.sur}` : ''}
                    </span>
                    {/* La part déjà payée, d'un coup d'œil. */}
                    <span className="progression" aria-hidden="true" style={{ marginTop: 4 }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, ((mois > fin ? d.nombre : rang?.rang ?? 0) / d.nombre) * 100)}%`, background: 'var(--primaire)', borderRadius: 4 }} />
                    </span>
                  </div>
                  <div className="droite"><strong className="chiffre">{dollars(mensualiteDepense(d, mois))}</strong><span className="discret">ce mois-ci</span></div>
                  <Icone nom="chevron" taille={18} />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {ouverte !== undefined ? <FeuilleDepense depense={ouverte} onFermer={() => setOuverte(undefined)} /> : null}
      {hypotheque ? <FeuilleHypotheque onFermer={() => setHypotheque(false)} /> : null}
    </>
  );
}
