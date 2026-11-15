import { useMemo } from 'react';
import { useSession } from '../donnees/Session';
import { resumeDuMois, planifier, premierMoisNegatif, totalProportions, PAIES } from '../calc/budget';
import { moisDe, libelleMois } from '../calc/mois';
import { dollars, pourcent } from '../donnees/format';
import { Avis, Vide } from '../composants/ui';

/** L'anneau d'autosuffisance : la part des sorties que les loyers couvrent. */
function Jauge({ taux }) {
  const rayon = 52;
  const tour = 2 * Math.PI * rayon;
  // Au-delà de 100 %, l'anneau reste plein : le chiffre dit le reste.
  const part = Math.max(0, Math.min(1, taux ?? 0));
  return (
    <svg viewBox="0 0 132 132" role="img" aria-label={taux === null ? 'Autosuffisance : à déterminer' : `Autosuffisance : ${pourcent(taux)}`}>
      <circle className="piste" cx="66" cy="66" r={rayon} fill="none" strokeWidth="13" />
      <circle className={`arc${part >= 1 ? ' atteint' : ''}`} cx="66" cy="66" r={rayon} fill="none" strokeWidth="13"
        strokeLinecap="round" strokeDasharray={tour} strokeDashoffset={tour * (1 - part)} transform="rotate(-90 66 66)" />
      <text x="66" y="75" textAnchor="middle">{taux === null ? '—' : pourcent(taux)}</text>
    </svg>
  );
}

export default function Apercu({ allerA }) {
  const { copro, user } = useSession();
  const mois = moisDe();
  const resume = useMemo(() => resumeDuMois(copro, mois), [copro, mois]);
  const plan = useMemo(() => planifier(copro, mois), [copro, mois]);
  const negatif = premierMoisNegatif(plan);
  const dansUnAn = plan.at(-1);
  const proportions = totalProportions(copro);
  const membres = Object.entries(copro.members);
  const rienDeSaisi = !copro.logements.length && !copro.depenses.length && !copro.hypotheque;

  return (
    <>
      <div className="entete">
        <div>
          <h1>{copro.nom}</h1>
          <p className="discret">{libelleMois(mois)}</p>
        </div>
      </div>

      {rienDeSaisi ? (
        <section className="carte">
          <Vide titre="Tout commence ici"
            texte="Ajoutez vos logements et leurs loyers, puis vos dépenses et l'hypothèque. L'application vous dira ce que la copropriété paie d'elle-même, et ce qu'il reste à verser."
            action={<div className="boutons" style={{ justifyContent: 'center' }}>
              <button className="bouton" onClick={() => allerA('revenus')}>Ajouter un logement</button>
              <button className="bouton doux" onClick={() => allerA('depenses')}>Ajouter une dépense</button>
            </div>} />
        </section>
      ) : (
        <>
          <section className="carte" aria-label="Autosuffisance">
            <div className="jauge">
              <Jauge taux={resume.taux} />
              <div className="texte">
                <span className="discret">Autosuffisance</span>
                {resume.taux === null ? (
                  <span className="gros">Aucune sortie saisie</span>
                ) : resume.manque > 0 ? (
                  <>
                    <span className="gros">Il manque <span className="chiffre">{dollars(resume.manque)}</span> par mois</span>
                    <span className="discret">Les loyers couvrent {pourcent(resume.taux)} des sorties.</span>
                  </>
                ) : (
                  <>
                    <span className="gros bon">Autosuffisante</span>
                    <span className="discret">Surplus de <span className="chiffre">{dollars(resume.surplus)}</span> par mois, qui reste au compte.</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {negatif ? (
            <Avis ton="alerte">Le solde du compte passe sous zéro en <strong>{libelleMois(negatif)}</strong>. <button className="bouton texte" onClick={() => allerA('planification')}>Voir la planification</button></Avis>
          ) : null}

          <section className="carte">
            <header><h2>Fonds de roulement du mois</h2></header>
            <div>
              <div className="ligne"><span>Loyers</span><span className="chiffre bon">+ {dollars(resume.revenus)}</span></div>
              <div className="ligne"><span>Dépenses, lissées sur l'année</span><span className="chiffre">− {dollars(resume.depenses)}</span></div>
              <div className="ligne"><span>Hypothèque</span><span className="chiffre">− {dollars(resume.hypotheque)}</span></div>
              <div className="ligne total">
                <span>{resume.manque > 0 ? 'À verser par les copropriétaires' : 'Surplus'}</span>
                <span className={`chiffre ${resume.manque > 0 ? '' : 'bon'}`}>{dollars(resume.manque > 0 ? resume.manque : resume.surplus)}</span>
              </div>
            </div>
          </section>

          <section className="carte">
            <header><h2>Part de chacun</h2></header>
            {Math.abs(proportions - 100) > 0.01 ? (
              <Avis ton="attention">Les proportions totalisent {Math.round(proportions * 100) / 100} % au lieu de 100 %. Le gestionnaire les répartit dans <button className="bouton texte" onClick={() => allerA('reglages')}>Réglages</button></Avis>
            ) : null}
            <div className="liste">
              {membres.map(([uid, m]) => (
                <div className="element" key={uid} style={{ cursor: 'default' }}>
                  <div className="corps">
                    <strong>{m.displayName}{uid === user.uid ? ' (vous)' : ''}</strong>
                    <span className="discret">{m.proportion} % · {PAIES[m.frequencePaie]?.libelle.toLowerCase()}</span>
                  </div>
                  <div className="droite">
                    <strong className="chiffre">{dollars(resume.parts[uid].mensuel)} / mois</strong>
                    {m.frequencePaie !== 'mensuel' ? <span className="discret chiffre">{dollars(resume.parts[uid].parPaie)} par paie</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {resume.taux !== null ? (
            <section className="carte">
              <header><h2>Vers l'autosuffisance</h2></header>
              <div className="progression" aria-hidden="true"><div style={{ width: `${Math.min(100, resume.taux * 100)}%` }} /></div>
              {resume.manque > 0 ? (
                <p>Pour que la copropriété se paie toute seule, il faudrait <strong className="chiffre">{dollars(resume.manque)}</strong> de loyers de plus par mois
                  {resume.revenus > 0 ? <> (une hausse de {pourcent(resume.manque / resume.revenus)})</> : null}, ou autant de sorties en moins.</p>
              ) : (
                <p>Les loyers couvrent toutes les sorties, capital de l'hypothèque compris.</p>
              )}
              {dansUnAn.taux !== null && Math.abs(dansUnAn.taux - resume.taux) >= 0.005 ? (
                <p className="discret">D'après ce qui est planifié, le taux sera de {pourcent(dansUnAn.taux)} en {libelleMois(dansUnAn.mois)}.</p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
