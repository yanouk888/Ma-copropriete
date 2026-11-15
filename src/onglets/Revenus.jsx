import { useState } from 'react';
import { useCopro } from '../donnees/Session';
import { loyerDuMois, montantEnVigueur, poserPalier, revenusDuMois } from '../calc/budget';
import { moisDe, libelleMois, ajouterMois } from '../calc/mois';
import { dollars } from '../donnees/format';
import { nouvelId } from '../donnees/code';
import { Feuille, Champ, ChampMontant, ChampMois, Bascule, Icone, Vide, montantValide } from '../composants/ui';

function FeuilleLogement({ logement, onFermer }) {
  const { copro, modifier } = useCopro();
  const mois = moisDe();
  const nouveau = !logement;
  const loyerActuel = logement ? montantEnVigueur(logement.paliers, mois) ?? logement.paliers[0].montant : '';
  const [nom, setNom] = useState(logement?.nom || '');
  const [loyer, setLoyer] = useState(String(loyerActuel).replace('.', ','));
  const [depuis, setDepuis] = useState(mois);
  const [vacances, setVacances] = useState(logement?.vacances || []);
  const [moisVacant, setMoisVacant] = useState(ajouterMois(mois, 1));
  const [ferme, setFerme] = useState(Boolean(logement?.fin));
  const [fin, setFin] = useState(logement?.fin || mois);
  const [erreur, setErreur] = useState('');

  const loyerChange = nouveau || montantValide(loyer, { zeroPermis: true }) !== Number(loyerActuel);

  const enregistrer = (e) => {
    e.preventDefault();
    const montant = montantValide(loyer, { zeroPermis: true });
    if (montant === null) { setErreur('Entrez le loyer mensuel, en dollars.'); return; }
    const suivant = {
      id: logement?.id || nouvelId(),
      nom: nom.trim(),
      paliers: nouveau ? [{ depuis, montant }] : loyerChange ? poserPalier(logement.paliers, depuis, montant) : logement.paliers,
      vacances: [...vacances].sort(),
      fin: ferme ? fin : null,
    };
    // Un changement daté d'avant le premier palier le remplace : il ne reste
    // alors qu'un palier, celui qu'on vient de poser.
    if (!suivant.paliers.length) suivant.paliers = [{ depuis, montant }];
    modifier({ logements: nouveau ? [...copro.logements, suivant] : copro.logements.map((l) => (l.id === suivant.id ? suivant : l)) });
    onFermer();
  };

  const supprimer = () => {
    if (!window.confirm(`Supprimer « ${logement.nom} » et tout son historique de loyers ?`)) return;
    modifier({ logements: copro.logements.filter((l) => l.id !== logement.id) });
    onFermer();
  };

  return (
    <Feuille titre={nouveau ? 'Nouveau logement' : logement.nom} onFermer={onFermer}>
      <form onSubmit={enregistrer}>
        <Champ libelle="Nom du logement">
          <input value={nom} onChange={(e) => setNom(e.target.value)} required maxLength={40} placeholder="Appartement 1" />
        </Champ>
        <ChampMontant libelle="Loyer mensuel" valeur={loyer} onChange={setLoyer} erreur={erreur} />
        {loyerChange ? (
          <ChampMois libelle={nouveau ? 'Loué à partir de' : 'Nouveau loyer à partir de'} valeur={depuis} onChange={setDepuis}
            aide={nouveau ? null : 'Les mois d\'avant gardent l\'ancien loyer. Choisissez un mois à venir pour planifier une hausse.'} />
        ) : null}
        {!nouveau && logement.paliers.length > 1 ? (
          <details>
            <summary>Historique des loyers</summary>
            {logement.paliers.map((p) => (
              <div className="ligne" key={p.depuis}><span>Depuis {libelleMois(p.depuis)}</span><span className="chiffre">{dollars(p.montant)}</span></div>
            ))}
          </details>
        ) : null}
        <div className="champ">
          <span>Mois sans locataire</span>
          {vacances.length ? (
            <div className="puces">
              {[...vacances].sort().map((m) => (
                <span className="puce" key={m}>{libelleMois(m, { court: true })}
                  <button type="button" aria-label={`Retirer ${libelleMois(m)}`} onClick={() => setVacances(vacances.filter((v) => v !== m))}><Icone nom="fermer" taille={16} /></button>
                </span>
              ))}
            </div>
          ) : <small>Aucun. Un mois vacant ne rapporte aucun loyer.</small>}
          <ChampMois libelle="Ajouter un mois vacant" valeur={moisVacant} onChange={setMoisVacant} />
          <button type="button" className="bouton contour" disabled={vacances.includes(moisVacant)}
            onClick={() => setVacances([...vacances, moisVacant])}>Ajouter {libelleMois(moisVacant)}</button>
        </div>
        <Bascule libelle="Ce logement cesse d'être loué" coche={ferme} onChange={setFerme} />
        {ferme ? <ChampMois libelle="Dernier mois de loyer" valeur={fin} onChange={setFin} /> : null}
        <div className="pied">
          {!nouveau ? <button type="button" className="bouton danger gauche" onClick={supprimer}>Supprimer</button> : null}
          <button type="button" className="bouton texte" onClick={onFermer}>Annuler</button>
          <button className="bouton">Enregistrer</button>
        </div>
      </form>
    </Feuille>
  );
}

export default function Revenus() {
  const { copro } = useCopro();
  const mois = moisDe();
  // undefined = fermée, null = nouveau logement, sinon le logement à modifier.
  const [ouvert, setOuvert] = useState(undefined);

  const prochain = (l) => l.paliers.find((p) => p.depuis > mois);

  return (
    <>
      <div className="entete">
        <div><h1>Revenus</h1><p className="discret">Les loyers de chaque logement</p></div>
        <button className="bouton" onClick={() => setOuvert(null)}><Icone nom="plus" taille={18} />Logement</button>
      </div>

      <section className="carte">
        <div className="ligne total"><span>Loyers de {libelleMois(mois)}</span><span className="chiffre bon">{dollars(revenusDuMois(copro, mois))}</span></div>
      </section>

      <section className="carte">
        {copro.logements.length ? (
          <div className="liste">
            {copro.logements.map((l) => {
              const loyer = loyerDuMois(l, mois);
              const hausse = prochain(l);
              const vacant = (l.vacances || []).includes(mois);
              const ferme = l.fin && mois > l.fin;
              return (
                <button className="element" key={l.id} onClick={() => setOuvert(l)}>
                  <div className="corps">
                    <strong>{l.nom}</strong>
                    <span className="discret">
                      {ferme ? `N'est plus loué depuis ${libelleMois(ajouterMois(l.fin, 1))}`
                        : vacant ? 'Vacant ce mois-ci'
                        : hausse ? `${dollars(hausse.montant)} à partir de ${libelleMois(hausse.depuis)}`
                        : montantEnVigueur(l.paliers, mois) === null ? `Loué à partir de ${libelleMois(l.paliers[0].depuis)}`
                        : 'Loué'}
                    </span>
                  </div>
                  <div className="droite"><strong className="chiffre">{dollars(loyer)}</strong><span className="discret">par mois</span></div>
                  <Icone nom="chevron" taille={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <Vide titre="Aucun logement" texte="Ajoutez chaque logement loué avec son loyer mensuel."
            action={<button className="bouton" onClick={() => setOuvert(null)}>Ajouter un logement</button>} />
        )}
      </section>

      {ouvert !== undefined ? <FeuilleLogement logement={ouvert} onFermer={() => setOuvert(undefined)} /> : null}
    </>
  );
}
