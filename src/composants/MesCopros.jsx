import { useMemo, useState } from 'react';
import { useSession } from '../donnees/Session';
import { resumeDuMois } from '../calc/budget';
import { moisDe } from '../calc/mois';
import { dollars, pourcent } from '../donnees/format';
import { Feuille, Icone } from './ui';
import NouvelleCopro from './NouvelleCopro';
import { lectureSeule, proprietairesActifs } from '../calc/proprietaires';

/**
 * « Mes copropriétés » : passer de l'une à l'autre, voir ce que chacune coûte
 * ou rapporte, et le total de ses parts. Chacune a ses co-investisseurs ; ce
 * total n'est visible que de soi.
 */
export function FeuilleMesCopros({ onFermer }) {
  const { user, copro, mesCopros, actions } = useSession();
  const [ajout, setAjout] = useState(false);
  const mois = moisDe();
  // Une propriété vendue — ou où l'on a vendu sa part — reste dans la liste,
  // pour son rapport, mais ne compte plus dans le total.
  const lignes = useMemo(() => mesCopros.map((c) => {
    const r = resumeDuMois(c, mois);
    const fermee = lectureSeule(c, user.uid);
    return { c, r, fermee, part: fermee ? 0 : r.parts[user.uid]?.mensuel ?? 0 };
  }), [mesCopros, mois, user.uid]);
  const total = lignes.reduce((s, l) => s + l.part, 0);

  return (
    <Feuille titre={ajout ? 'Ajouter une copropriété' : 'Mes copropriétés'} onFermer={onFermer}>
      <div className="contenu">
        {ajout ? (
          <>
            <p className="discret">Une copropriété par groupe de co-investisseurs : chacune a ses logements, ses dépenses, son hypothèque et son code d'invitation, et ses membres ne voient qu'elle.</p>
            <NouvelleCopro apres={onFermer} />
            <button type="button" className="bouton texte" onClick={() => setAjout(false)}>Retour</button>
          </>
        ) : (
          <>
            <div className="liste">
              {lignes.map(({ c, r, part, fermee }, i) => (
                <button key={c.id} type="button" className="element" style={{ '--i': i }}
                  aria-current={c.id === copro?.id ? 'true' : undefined}
                  onClick={() => { if (c.id !== copro?.id) actions.choisir(c.id); onFermer(); }}>
                  <div className="corps">
                    <strong>{c.nom}{c.id === copro?.id ? ' · ouverte' : ''}</strong>
                    {c.entreprise ? <span className="discret">{c.entreprise}</span> : null}
                    {/* Chaque propriété a ses propres propriétaires : on les nomme. */}
                    <span className="discret">
                      {proprietairesActifs(c).map((p) => p.displayName).join(', ')}
                      {!fermee && r.taux !== null ? ` · ${pourcent(r.taux)} autosuffisante` : ''}
                    </span>
                  </div>
                  <div className="droite">
                    {fermee ? (
                      <span className="etiquette-vendue">{c.vendue ? 'Vendue' : 'Part vendue'}</span>
                    ) : (
                      <>
                        <strong className="chiffre">{dollars(part)}</strong>
                        <span className="discret">ma part / mois</span>
                      </>
                    )}
                  </div>
                  <Icone nom="chevron" taille={18} />
                </button>
              ))}
            </div>
            {lignes.filter((l) => !l.fermee).length > 1 ? (
              <div className="ligne total"><span>Ma part, toutes copropriétés</span><span className="chiffre">{dollars(total)} / mois</span></div>
            ) : null}
            <button type="button" className="bouton contour" onClick={() => setAjout(true)}><Icone nom="plus" taille={18} />Ajouter une copropriété</button>
          </>
        )}
      </div>
    </Feuille>
  );
}
