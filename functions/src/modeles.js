// Le contenu des courriels : des fonctions pures, sans Firebase ni réseau,
// pour qu'on puisse les essayer seules (npm test) et regarder le résultat.
//
// Règles tenues :
//  - tout ce qu'un utilisateur a tapé (nom de la copropriété, prénoms) est
//    échappé : un nom contenant du HTML ne doit pas devenir du HTML ;
//  - aucune image hébergée, aucun pixel de suivi, aucune police distante
//    (docs/empreinte-numerique.md) : le courriel s'affiche tel quel, et
//    personne ne sait quand il a été ouvert ;
//  - toujours une version texte, pour les lecteurs qui n'affichent pas le HTML.
import { resumeDuMois, planifier, premierMoisNegatif } from '../calc/budget.js';
import { libelleMois } from '../calc/mois.js';

export const echapper = (t) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const dollars = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(n) || 0);

const pourcent = (r) => `${Math.round(r * 100)} %`;

// L'habillage commun. Des tableaux et des styles en ligne : c'est encore ce
// que les logiciels de courriel affichent le plus fidèlement.
function gabarit({ titre, corps, bouton, pied }) {
  return `<!doctype html>
<html lang="fr-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#17201c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#1f6b5c;background:linear-gradient(135deg,#134e42,#2c8d76);padding:22px 24px;color:#ffffff">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Mes copropriétés</div>
<div style="font-size:22px;font-weight:700;line-height:1.25;margin-top:4px">${echapper(titre)}</div>
</td></tr>
<tr><td style="padding:22px 24px;font-size:15px;line-height:1.5">${corps}
${bouton ? `<p style="margin:24px 0 4px"><a href="${echapper(bouton.lien)}" style="display:inline-block;background:#1f6b5c;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${echapper(bouton.texte)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:0 24px 22px;font-size:12px;color:#5a6660;line-height:1.5">${pied}</td></tr>
</table></td></tr></table></body></html>`;
}

const ligne = (libelle, valeur, fort = false) =>
  `<tr><td style="padding:8px 0;border-top:1px solid #e3e8e3${fort ? ';font-weight:700' : ''}">${echapper(libelle)}</td><td align="right" style="padding:8px 0;border-top:1px solid #e3e8e3;white-space:nowrap${fort ? ';font-weight:700' : ''}">${echapper(valeur)}</td></tr>`;

/** Le courriel d'invitation : qui invite, où, le code, et un bouton qui le pré-remplit. */
export function courrielInvitation({ nomInviteur, nomCopro, code, adresseApp }) {
  const lien = `${adresseApp.replace(/\/+$/, '')}/?code=${encodeURIComponent(code)}`;
  const titre = `${nomInviteur} vous invite dans « ${nomCopro} »`;
  return {
    sujet: titre,
    html: gabarit({
      titre,
      corps: `<p style="margin:0 0 14px">${echapper(nomInviteur)} tient le budget de la copropriété <strong>${echapper(nomCopro)}</strong> dans Mes copropriétés, et vous invite à le partager : loyers, dépenses, fonds de roulement et part de chacun.</p>
<p style="margin:0 0 6px">Votre code d'invitation :</p>
<p style="margin:0;font:600 22px/1.3 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em">${echapper(code)}</p>`,
      bouton: { texte: 'Rejoindre la copropriété', lien },
      pied: `Le bouton ouvre l'application avec le code déjà rempli : créez votre compte ou connectez-vous, puis touchez « Rejoindre ».<br>Vous n'attendiez pas cette invitation ? Ignorez ce courriel : rien ne se passe sans vous.`,
    }),
    texte: `${titre}

${nomInviteur} tient le budget de la copropriété « ${nomCopro} » dans Mes copropriétés, et vous invite à le partager.

Votre code d'invitation : ${code}

Pour rejoindre : ${lien}
Créez votre compte ou connectez-vous, puis touchez « Rejoindre ».

Vous n'attendiez pas cette invitation ? Ignorez ce courriel : rien ne se passe sans vous.`,
  };
}

/**
 * Le résumé du mois pour un copropriétaire, ou null s'il n'y a rien à dire
 * (aucune sortie saisie) : un courriel vide apprend à ne plus les ouvrir.
 */
export function courrielResume({ copro, uid, mois, adresseApp }) {
  const r = resumeDuMois(copro, mois);
  if (r.taux === null) return null;
  const plan = planifier(copro, mois);
  const negatif = premierMoisNegatif(plan);
  const fin = plan.at(-1);
  const part = r.parts[uid]?.mensuel ?? 0;
  const nomMois = libelleMois(mois);
  const autosuffisante = r.manque === 0;
  const titre = autosuffisante
    ? `${copro.nom} se paie toute seule en ${nomMois}`
    : `${copro.nom} : ${pourcent(r.taux)} autosuffisante en ${nomMois}`;

  // La jauge, en barre : un tableau à deux cellules, que tout logiciel affiche.
  const largeur = Math.max(2, Math.min(100, Math.round(r.taux * 100)));
  const jauge = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr>
<td width="${largeur}%" style="height:12px;background:#1baf7a;border-radius:6px 0 0 6px${largeur === 100 ? ';border-radius:6px' : ''}"></td>
${largeur < 100 ? `<td style="height:12px;background:#e3e8e3;border-radius:0 6px 6px 0"></td>` : ''}
</tr></table>`;

  const alerte = negatif
    ? `<p style="margin:16px 0 0;padding:12px 14px;border-radius:12px;background:#fbe9e7;color:#b3261e">Attention : d'après la planification, le solde du compte passe sous zéro en <strong>${echapper(libelleMois(negatif))}</strong>.</p>`
    : '';

  return {
    sujet: titre,
    html: gabarit({
      titre,
      corps: `<p style="margin:0 0 6px">Les loyers couvrent <strong>${pourcent(r.taux)}</strong> des sorties ce mois-ci.</p>
${jauge}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">
${ligne('Loyers', dollars(r.revenus))}
${ligne('Sorties (fonds de roulement)', dollars(r.sorties))}
${autosuffisante ? ligne('Surplus', dollars(r.surplus), true) : ligne('À verser par les copropriétaires', dollars(r.manque), true)}
${autosuffisante ? '' : ligne('Votre part', `${dollars(part)} par mois`, true)}
${ligne(`Solde prévu fin ${libelleMois(fin.mois)}`, dollars(fin.soldeFin))}
</table>${alerte}`,
      bouton: { texte: 'Ouvrir Mes copropriétés', lien: adresseApp },
      pied: `Résumé envoyé le premier de chaque mois. Pour ne plus le recevoir : Réglages → Notifications → Résumé mensuel par courriel.`,
    }),
    texte: `${titre}

Les loyers couvrent ${pourcent(r.taux)} des sorties ce mois-ci.

Loyers : ${dollars(r.revenus)}
Sorties (fonds de roulement) : ${dollars(r.sorties)}
${autosuffisante ? `Surplus : ${dollars(r.surplus)}` : `À verser par les copropriétaires : ${dollars(r.manque)}\nVotre part : ${dollars(part)} par mois`}
Solde prévu fin ${libelleMois(fin.mois)} : ${dollars(fin.soldeFin)}
${negatif ? `\nAttention : le solde passe sous zéro en ${libelleMois(negatif)}.\n` : ''}
${adresseApp}

Pour ne plus recevoir ce résumé : Réglages → Notifications → Résumé mensuel par courriel.`,
  };
}
