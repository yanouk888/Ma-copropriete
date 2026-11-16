// Une fois par jour : les rappels qui dépendent de la date et non d'un geste.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { planifier, premierMoisNegatif } from '../calc/budget.js';
import { libelleMois, ecartMois } from '../calc/mois.js';
import { notifier, moisCourant } from './envoyer.js';
import { estVendue, aVendu } from '../calc/proprietaires.js';

// À combien de jours du renouvellement on prévient : le temps de magasiner un
// taux (90), de signer (30), et un dernier rappel.
const ECHEANCES = [90, 30, 7];

const jourMontreal = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(date);

export const rappelsQuotidiens = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/Toronto' },
  async () => {
    const aujourdhui = jourMontreal();
    const mois = moisCourant();
    const copros = await getFirestore().collection('copros').get();
    const envois = [];

    for (const doc of copros.docs) {
      const copro = doc.data();
      // Une propriété vendue n'a plus d'hypothèque ni de solde à surveiller,
      // et qui a vendu sa part n'a plus à en entendre parler.
      if (estVendue(copro)) continue;
      const membres = (copro.memberUids || []).filter((u) => !aVendu(copro, u));

      // ─── Renouvellement de l'hypothèque ───
      const terme = copro.hypotheque?.renouvellement;
      if (terme) {
        const jours = Math.round((Date.parse(terme) - Date.parse(aujourdhui)) / 86400000);
        if (ECHEANCES.includes(jours)) {
          for (const u of membres) {
            envois.push(notifier(u, {
              type: 'hypotheque',
              title: `Renouvellement de l'hypothèque dans ${jours} jours`,
              body: `${copro.nom} : le terme se termine le ${terme}.`,
            }));
          }
        }
      }

      // ─── Solde projeté négatif ───
      // Le premier du mois seulement, et pour les trois mois qui viennent :
      // le dire chaque jour, ou un an d'avance, apprend à ne plus le lire.
      if (aujourdhui.endsWith('-01')) {
        const negatif = premierMoisNegatif(planifier(copro, mois));
        if (negatif && ecartMois(mois, negatif) <= 3) {
          for (const u of membres) {
            envois.push(notifier(u, {
              type: 'planification',
              title: 'Le solde du compte va manquer',
              body: `${copro.nom} : la planification passe sous zéro en ${libelleMois(negatif)}.`,
            }));
          }
        }
      }
    }
    await Promise.all(envois);
  }
);
