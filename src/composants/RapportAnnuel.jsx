import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '../donnees/Session';
import { rapportAnnuel, rapportCsv, debutSuivi } from '../calc/suivi';
import { moisDe } from '../calc/mois';
import { dollars, lireMontant } from '../donnees/format';
import { Feuille, Champ, Avis, useToast } from './ui';

/**
 * Le rapport d'une année : ce qu'il faut pour remplir l'état des loyers
 * (T776 au fédéral, TP-128 au Québec), ou pour le remettre au comptable.
 *
 * Il ne compte que les paiements confirmés dans Suivi. Les intitulés sont
 * ceux des formulaires ; les numéros de ligne n'y sont pas, à dessein — ils
 * changent d'une année et d'un formulaire à l'autre.
 */
function Contenu({ copro, r, interets, setInterets, enregistrerInterets, imprimable = false }) {
  const parts = r.totalParts;
  return (
    <div className="rapport">
      {imprimable ? (
        <header className="rapport-entete">
          <h1>{copro.nom} — revenus et dépenses de location {r.annee}</h1>
          <p>Établi le {new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })} avec Mes copropriétés, à partir des paiements confirmés.</p>
        </header>
      ) : null}

      <h3>Revenus</h3>
      <div className="ligne total"><span>Loyers bruts reçus</span><span className="chiffre">{dollars(r.revenus)}</span></div>

      <h3>Dépenses courantes</h3>
      {r.rubriques.length ? r.rubriques.map((x) => (
        <div className="ligne" key={x.cle}><span>{x.libelle}</span><span className="chiffre">{dollars(x.montant)}</span></div>
      )) : <p className="discret">Aucune dépense confirmée cette année.</p>}
      <div className="ligne total"><span>Total des dépenses</span><span className="chiffre">{dollars(r.depenses)}</span></div>
      <div className="ligne total"><span>Revenu net (perte)</span><span className={`chiffre ${r.net < 0 ? 'mauvais' : ''}`}>{dollars(r.net)}</span></div>

      <h3>Intérêts hypothécaires</h3>
      <p className="discret">Compris dans « Intérêts et frais bancaires ». Calculés d'après les paiements confirmés : {dollars(r.interetsCalcules)}.</p>
      {imprimable ? (
        <div className="ligne"><span>Montant retenu{r.interetsDeclares !== null ? ' (relevé du prêteur)' : ' (calculé)'}</span><span className="chiffre">{dollars(r.interetsHypotheque)}</span></div>
      ) : (
        <form className="paire" onSubmit={(e) => { e.preventDefault(); enregistrerInterets(); }} style={{ alignItems: 'end' }}>
          <Champ libelle="Selon le relevé annuel du prêteur" aide="Il fait foi : saisissez-le dès que vous l'avez.">
            <input type="text" inputMode="decimal" value={interets} onChange={(e) => setInterets(e.target.value)} placeholder={String(r.interetsCalcules).replace('.', ',')} />
          </Champ>
          <button className="bouton contour">Retenir</button>
        </form>
      )}

      <h3>Non déduit cette année</h3>
      <div className="ligne"><span>Capital remboursé sur l'hypothèque</span><span className="chiffre">{dollars(r.capitalHypotheque)}</span></div>
      <div className="ligne"><span>Dépenses en capital (à amortir, DPA)</span><span className="chiffre">{dollars(r.enCapital)}</span></div>

      <h3>Taxes payées (à titre d'information)</h3>
      <div className="ligne"><span>TPS</span><span className="chiffre">{dollars(r.tps)}</span></div>
      <div className="ligne"><span>TVQ</span><span className="chiffre">{dollars(r.tvq)}</span></div>

      <h3>Part de chaque propriétaire</h3>
      {Math.abs(parts - 100) > 0.01 ? (
        <Avis ton="attention">Les parts de propriété totalisent {parts} % au lieu de 100 %. Le gestionnaire les règle dans Réglages → Copropriétaires.</Avis>
      ) : null}
      <div className="tableau-parts">
        <div className="entete-parts"><span>Propriétaire</span><span>Part</span><span>Revenus</span><span>Dépenses</span><span>Net</span></div>
        {r.proprietaires.map((p) => (
          <div key={p.uid}><span>{p.displayName || p.nom}</span><span className="chiffre">{p.pourcent} %</span><span className="chiffre">{dollars(p.revenus)}</span><span className="chiffre">{dollars(p.depenses)}</span><span className="chiffre">{dollars(p.net)}</span></div>
        ))}
      </div>

      <h3>Pièces justificatives</h3>
      <p className="discret">{r.paiements.filter((p) => p.pieces?.length).length} paiement(s) sur {r.paiements.length} ont leur facture ou leur reçu joint. Le détail est dans l'export CSV.</p>

      <p className="discret mention">Classement indicatif, sans valeur d'avis fiscal. Chaque propriétaire déclare sa part sur son propre T776 et son propre TP-128 (un formulaire par immeuble). Votre comptable a le dernier mot sur ce qui se déduit, et dans quelle ligne.</p>
    </div>
  );
}

export default function RapportAnnuel({ onFermer }) {
  const { copro, paiements, actions } = useSession();
  const toast = useToast();
  const courant = moisDe();
  const premiere = Number(debutSuivi(copro, courant).slice(0, 4));
  const derniere = Number(courant.slice(0, 4));
  const annees = [];
  for (let a = derniere; a >= premiere; a--) annees.push(a);
  const [annee, setAnnee] = useState(derniere);
  const r = useMemo(() => rapportAnnuel(copro, paiements, annee), [copro, paiements, annee]);
  const [interets, setInterets] = useState(r.interetsDeclares !== null ? String(r.interetsDeclares).replace('.', ',') : '');

  const changerAnnee = (a) => {
    setAnnee(a);
    const d = copro.interetsDeclares?.[a];
    setInterets(d !== undefined && d !== null ? String(d).replace('.', ',') : '');
  };
  const enregistrerInterets = () => {
    const vide = !interets.trim();
    const n = lireMontant(interets);
    if (!vide && (!Number.isFinite(n) || n < 0)) { toast('Entrez un montant en dollars, ou laissez vide pour garder le calcul.'); return; }
    // Un chemin par année : on ne réécrit pas celles des autres années.
    actions.modifier(copro.id, { [`interetsDeclares.${annee}`]: vide ? null : Math.round(n * 100) / 100 });
    toast(vide ? 'Intérêts calculés retenus.' : 'Relevé du prêteur retenu.');
  };
  const telecharger = () => {
    const url = URL.createObjectURL(new Blob([rapportCsv(r, copro.nom)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${copro.nom.replace(/[\\/:*?"<>|]/g, '-')} — ${annee}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <Feuille titre={`Rapport ${annee}`} onFermer={onFermer}>
      <div className="contenu">
        {annees.length > 1 ? (
          <Champ libelle="Année">
            <select value={annee} onChange={(e) => changerAnnee(Number(e.target.value))}>
              {annees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Champ>
        ) : null}
        <div className="boutons">
          <button type="button" className="bouton" onClick={() => window.print()}>Imprimer ou PDF</button>
          <button type="button" className="bouton contour" onClick={telecharger}>Télécharger le CSV</button>
        </div>
        <Contenu copro={copro} r={r} interets={interets} setInterets={setInterets} enregistrerInterets={enregistrerInterets} />
      </div>
      {/* La version imprimable vit hors de la fenêtre : une boîte de dialogue
          s'imprime mal (coupée à la hauteur de l'écran). Invisible à l'écran,
          seule visible à l'impression (styles.css, @media print). */}
      {createPortal(<div id="impression"><Contenu copro={copro} r={r} imprimable /></div>, document.body)}
    </Feuille>
  );
}
