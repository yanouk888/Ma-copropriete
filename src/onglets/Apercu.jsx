import { useMemo } from 'react';
import { useSession } from '../donnees/Session';
import { resumeDuMois, planifier, premierMoisNegatif, totalProportions, PAIES } from '../calc/budget';
import { moisDe, libelleMois } from '../calc/mois';
import { dollars, pourcent } from '../donnees/format';
import { Avis, Vide } from '../composants/ui';
import { Jauge, Nombre, EntreesSorties, Trajectoire, Avatar, couleurSerie } from '../composants/graphiques';

export default function Apercu({ allerA }) {
  const { copro, user } = useSession();
  const mois = moisDe();
  const resume = useMemo(() => resumeDuMois(copro, mois), [copro, mois]);
  const plan = useMemo(() => planifier(copro, mois), [copro, mois]);
  const negatif = premierMoisNegatif(plan);
  const proportions = totalProportions(copro);
  // La couleur d'un copropriétaire tient à son rang d'arrivée, pas à sa part :
  // elle ne change pas quand les proportions changent.
  const membres = copro.memberUids.filter((u) => copro.members[u]).map((u, i) => ({ uid: u, serie: (i % 7) + 1, ...copro.members[u] }));
  const rienDeSaisi = !copro.logements.length && !copro.depenses.length && !copro.hypotheque;
  const atteint = resume.taux !== null && resume.manque === 0;

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
          <section className={`hero${atteint ? ' atteint' : ''}`} aria-label="Autosuffisance">
            <Jauge taux={resume.taux} />
            <div className="texte">
              <span className="surtitre">Autosuffisance</span>
              {resume.taux === null ? (
                <span className="gros">Aucune sortie saisie</span>
              ) : resume.manque > 0 ? (
                <>
                  <span className="gros">Il manque <Nombre valeur={resume.manque} /> par mois</span>
                  <span className="sous">Les loyers couvrent {pourcent(resume.taux)} des sorties.</span>
                </>
              ) : (
                <>
                  <span className="gros">Autosuffisante</span>
                  <span className="sous">Surplus de <Nombre valeur={resume.surplus} /> par mois, qui reste au compte.</span>
                </>
              )}
            </div>
          </section>

          {negatif ? (
            <Avis ton="alerte">Le solde du compte passe sous zéro en <strong>{libelleMois(negatif)}</strong>. <button className="bouton texte" onClick={() => allerA('planification')}>Voir la planification</button></Avis>
          ) : null}

          <section className="carte">
            <header><h2>Ce mois-ci</h2></header>
            <EntreesSorties entrees={resume.revenus} sorties={resume.sorties} />
            <div>
              <div className="ligne"><span>Dépenses, lissées sur l'année</span><span className="chiffre">{dollars(resume.depenses)}</span></div>
              <div className="ligne"><span>Hypothèque</span><span className="chiffre">{dollars(resume.hypotheque)}</span></div>
              <div className="ligne total">
                <span>{resume.manque > 0 ? 'À verser par les copropriétaires' : 'Surplus'}</span>
                <Nombre valeur={resume.manque > 0 ? resume.manque : resume.surplus} className={resume.manque > 0 ? '' : 'bon'} />
              </div>
            </div>
          </section>

          <section className="carte">
            <header><h2>Part de chacun</h2></header>
            {Math.abs(proportions - 100) > 0.01 ? (
              <Avis ton="attention">Les proportions totalisent {Math.round(proportions * 100) / 100} % au lieu de 100 %. Le gestionnaire les répartit dans <button className="bouton texte" onClick={() => allerA('reglages')}>Réglages</button></Avis>
            ) : null}
            {membres.length > 1 && proportions > 0 ? (
              <div className="barre-proportions" role="img" aria-label={`Proportions : ${membres.map((m) => `${m.displayName} ${m.proportion} %`).join(', ')}`}>
                {membres.filter((m) => m.proportion > 0).map((m) => <span key={m.uid} style={{ flexGrow: m.proportion, background: couleurSerie(m.serie) }} />)}
              </div>
            ) : null}
            <div className="liste">
              {membres.map((m, i) => (
                <div className="element" key={m.uid} style={{ cursor: 'default', '--i': i }}>
                  <Avatar nom={m.displayName} serie={m.serie} />
                  <div className="corps">
                    <strong>{m.displayName}{m.uid === user.uid ? ' (vous)' : ''}</strong>
                    <span className="discret">{m.proportion} % · {PAIES[m.frequencePaie]?.libelle.toLowerCase()}</span>
                  </div>
                  <div className="droite">
                    <strong><Nombre valeur={resume.parts[m.uid].mensuel} /> / mois</strong>
                    {m.frequencePaie !== 'mensuel' ? <span className="discret chiffre">{dollars(resume.parts[m.uid].parPaie)} par paie</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {resume.taux !== null ? (
            <section className="carte">
              <header><h2>Vers l'autosuffisance</h2></header>
              <Trajectoire plan={plan} />
              {resume.manque > 0 ? (
                <p>Pour que la copropriété se paie toute seule, il faudrait <strong className="chiffre">{dollars(resume.manque)}</strong> de loyers de plus par mois
                  {resume.revenus > 0 ? <> (une hausse de {pourcent(resume.manque / resume.revenus)})</> : null}, ou autant de sorties en moins.</p>
              ) : (
                <p>Les loyers couvrent toutes les sorties, capital de l'hypothèque compris.</p>
              )}
              <p className="discret">La courbe suit ce qui est planifié sur 13 mois ; la ligne marque les 100 %.</p>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
