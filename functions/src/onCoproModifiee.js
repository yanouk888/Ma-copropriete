// À chaque modification d'une copropriété, dit aux autres ce qui a changé.
//
// L'auteur du changement (`modifiePar`) n'est jamais notifié de son propre
// geste : il l'a sous les yeux.
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { resumeDuMois, planifier, premierMoisNegatif } from '../calc/budget.js';
import { libelleMois } from '../calc/mois.js';
import { notifier, dollars, moisCourant } from './envoyer.js';

const ids = (liste) => new Set((liste || []).map((x) => x.id));

export const onCoproModifiee = onDocumentUpdated('copros/{coproId}', async (event) => {
  const avant = event.data.before.data();
  const apres = event.data.after.data();
  if (!avant || !apres) return;

  const auteur = apres.modifiePar || null;
  const membres = apres.memberUids || [];
  const autres = membres.filter((u) => u !== auteur);
  const nomAuteur = apres.members?.[auteur]?.displayName || 'Quelqu\'un';
  const envois = [];
  const aTous = (uids, message) => uids.forEach((u) => envois.push(notifier(u, message)));

  // ─── Arrivées et départs ───
  const etaient = new Set(avant.memberUids || []);
  for (const u of membres.filter((x) => !etaient.has(x))) {
    aTous(membres.filter((x) => x !== u), {
      type: 'membres',
      title: `${apres.members?.[u]?.displayName || 'Un copropriétaire'} a rejoint ${apres.nom}`,
      body: 'Sa proportion est à 0 % : le gestionnaire doit répartir les parts.',
    });
  }
  for (const u of [...etaient].filter((x) => !membres.includes(x))) {
    aTous(autres, {
      type: 'membres',
      title: `${avant.members?.[u]?.displayName || 'Un copropriétaire'} a quitté ${apres.nom}`,
      body: 'Les proportions sont à revoir.',
    });
  }

  // ─── Nouvelles dépenses, nouveaux logements ───
  const depensesAvant = ids(avant.depenses);
  for (const d of (apres.depenses || []).filter((x) => !depensesAvant.has(x.id))) {
    // Récurrente : le montant de chaque paiement ; ponctuelle ou en versements : le total.
    const montant = d.type === 'recurrente' || !d.type ? d.paliers?.[0]?.montant : d.montant;
    const detail = d.type === 'versements' ? ` en ${d.nombre} versements` : '';
    aTous(autres, { type: 'depenses', title: `Nouvelle dépense : ${d.nom}`, body: `${dollars(montant)}${detail}, ajoutée par ${nomAuteur}.` });
  }
  const logementsAvant = ids(avant.logements);
  for (const l of (apres.logements || []).filter((x) => !logementsAvant.has(x.id))) {
    aTous(autres, { type: 'depenses', title: `Nouveau logement : ${l.nom}`, body: `Loyer de ${dollars(l.paliers?.[0]?.montant)}, ajouté par ${nomAuteur}.` });
  }

  // ─── Ce que le changement fait au budget ───
  const mois = moisCourant();
  const rAvant = resumeDuMois(avant, mois);
  const rApres = resumeDuMois(apres, mois);

  // Le versement de chacun. Sous un dollar d'écart, ce n'est qu'un arrondi.
  for (const u of autres) {
    const a = rAvant.parts[u]?.mensuel;
    const b = rApres.parts[u]?.mensuel;
    if (a === undefined || b === undefined || Math.abs(b - a) < 1) continue;
    envois.push(notifier(u, {
      type: 'versement',
      title: `Votre part mensuelle a ${b > a ? 'augmenté' : 'diminué'}`,
      body: `${dollars(a)} → ${dollars(b)} par mois.`,
    }));
  }

  // L'objectif de l'application : on le dit à tout le monde, auteur compris.
  if (rAvant.taux !== null && rAvant.taux < 1 && rApres.taux !== null && rApres.taux >= 1) {
    aTous(membres, {
      type: 'autosuffisance',
      title: `${apres.nom} est autosuffisante`,
      body: 'Les loyers couvrent maintenant toutes les sorties du mois.',
    });
  }

  // Le solde projeté vient de passer sous zéro.
  const negAvant = premierMoisNegatif(planifier(avant, mois));
  const negApres = premierMoisNegatif(planifier(apres, mois));
  if (!negAvant && negApres) {
    aTous(autres, {
      type: 'planification',
      title: 'Le solde projeté passe sous zéro',
      body: `En ${libelleMois(negApres)}, d'après la planification.`,
    });
  }

  await Promise.all(envois);
});
