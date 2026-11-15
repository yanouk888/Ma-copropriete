// Nouveautés de la version : l'entrée du CHANGELOG qui la décrit, compilée
// dans le bundle pour être affichée dans la section « À propos ».
//
// Lue à la compilation plutôt que téléchargée : la note décrit le bundle qui
// tourne sur l'appareil, pas la dernière version publiée — c'est tout l'intérêt
// d'une note posée à côté du numéro de version. Et le CHANGELOG reste la seule
// chose à écrire : aucun second texte à tenir à jour à chaque mise à jour.
//
// Ce fichier est le même dans chaque projet ; le corriger ici, c'est le
// corriger partout.

import { existsSync, readFileSync } from 'node:fs'

// « Rien ne change dans l'application », « Rien ne change à l'usage » : c'est
// ainsi que le journal annonce une version sans nouveauté visible (consignes,
// essais, robots). La note remonte alors à la dernière version qui a vraiment
// apporté quelque chose, au lieu d'afficher un « rien » sous le numéro.
// Il faut que CHAQUE point de l'entrée le dise : une entrée qui a d'autres
// points et en précise un (« Rien ne change dans le calcul ») reste une
// nouveauté.
const SANS_NOUVEAUTE = /rien ne change/i

const echapper = (texte) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Le sous-ensemble de Markdown qu'emploie le journal : gras, italique, code,
// liens. Un lien garde son texte et perd sa cible : un fichier du dépôt cité
// dans le journal ne mène nulle part depuis l'application.
function enLigne(texte) {
  return texte
    .split(/(`[^`]*`)/)
    .map((morceau) => {
      if (/^`[^`]*`$/.test(morceau)) return `<code>${echapper(morceau.slice(1, -1))}</code>`
      return echapper(morceau)
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(«])[*_](\S(?:.*?\S)?)[*_](?=[\s).,;:!?»]|$)/g, '$1<em>$2</em>')
    })
    .join('')
}

// Paragraphes et listes, imbriquées de deux espaces en deux espaces ; une
// ligne indentée qui n'ouvre pas de point continue le précédent.
function blocs(lignes) {
  const racine = []
  let paragraphe = null
  let pile = [] // [{ profondeur, points }] du point le plus extérieur au plus intérieur

  const fermer = () => {
    paragraphe = null
    pile = []
  }

  for (const ligne of lignes) {
    if (!ligne.trim()) {
      fermer()
      continue
    }
    const point = /^(\s*)[-*] +(.*)$/.exec(ligne)
    const intertitre = /^#{3,} +(.*)$/.exec(ligne)
    if (intertitre) {
      fermer()
      racine.push({ texte: `**${intertitre[1].trim()}**` })
    } else if (point) {
      paragraphe = null
      const profondeur = Math.floor(point[1].length / 2)
      while (pile.length && pile[pile.length - 1].profondeur > profondeur) pile.pop()
      let liste = pile[pile.length - 1]
      if (!liste || liste.profondeur < profondeur) {
        const parent = liste?.points[liste.points.length - 1]
        liste = { profondeur, points: [] }
        if (parent) parent.enfants.push(liste)
        else racine.push({ liste })
        pile.push(liste)
      }
      liste.points.push({ texte: point[2].trim(), enfants: [] })
    } else if (pile.length && /^\s/.test(ligne)) {
      const dernier = pile[pile.length - 1].points.at(-1)
      dernier.texte += ' ' + ligne.trim()
    } else if (paragraphe) {
      paragraphe.texte += ' ' + ligne.trim()
    } else {
      pile = []
      paragraphe = { texte: ligne.trim().replace(/^>\s?/, '') }
      racine.push(paragraphe)
    }
  }
  return racine
}

const htmlListe = (liste) =>
  '<ul>' +
  liste.points.map((p) => `<li>${enLigne(p.texte)}${p.enfants.map(htmlListe).join('')}</li>`).join('') +
  '</ul>'

const html = (racine) => racine.map((b) => (b.liste ? htmlListe(b.liste) : `<p>${enLigne(b.texte)}</p>`)).join('')

// Les points de premier niveau : c'est sur eux que se juge « sans nouveauté ».
const pointsPrincipaux = (racine) =>
  racine.flatMap((b) => (b.liste ? b.liste.points.map((p) => p.texte) : [b.texte]))

// Combien de versions précédentes l'historique de « À propos » emporte. Le
// journal de Mon horaire + en compte près de trois cents : les compiler toutes
// alourdirait chaque téléchargement pour des pages que personne ne lit, et le
// CHANGELOG du dépôt reste là pour le reste.
const HISTORIQUE = 10

/**
 * Lit le journal et rend la note de la version `version` :
 * `{ version, date, html, courante, historique }`. `courante` dit si la note
 * est celle de la version installée ou, faute de nouveauté, d'une version
 * antérieure ; `historique` donne les versions précédentes qui ont changé
 * quelque chose à l'écran, de la plus récente à la plus ancienne, chacune
 * `{ version, date, html }`.
 *
 * `chemins` : où chercher le journal, dans l'ordre. Plusieurs parce qu'une
 * image Docker n'a pas toujours la racine du dépôt dans son contexte.
 *
 * Lève une erreur plutôt que de rendre une note vide : la note doit toujours
 * être là, et un build qui la perdrait en silence le ferait des semaines.
 */
export function nouveautes(version, chemins) {
  const chemin = chemins.map((c) => (c instanceof URL ? c : new URL(c))).find((c) => existsSync(c))
  if (!chemin) throw new Error(`CHANGELOG.md introuvable (cherché : ${chemins.join(', ')})`)

  const entrees = []
  for (const ligne of readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const titre = /^## +(\d+\.\d+\.\d+)\s*(?:[—–-]\s*(.*))?$/.exec(ligne)
    if (titre) entrees.push({ version: titre[1], date: (titre[2] || '').trim(), lignes: [] })
    else if (/^#{1,2} /.test(ligne)) entrees.length && entrees.push(null)
    else if (entrees.length && entrees.at(-1)) entrees.at(-1).lignes.push(ligne)
  }
  const liste = entrees.filter(Boolean)

  const depart = liste.findIndex((e) => e.version === version)
  if (depart < 0) {
    throw new Error(`CHANGELOG.md n'a pas d'entrée « ## ${version} » : ajouter celle de la nouvelle version.`)
  }

  // Les entrées qui ont apporté quelque chose, depuis la version installée.
  const utiles = []
  for (const entree of liste.slice(depart)) {
    const racine = blocs(entree.lignes)
    const points = pointsPrincipaux(racine)
    if (!points.length || points.every((p) => SANS_NOUVEAUTE.test(p))) continue
    utiles.push({ version: entree.version, date: entree.date, html: html(racine) })
    if (utiles.length > HISTORIQUE) break
  }

  if (!utiles.length) {
    // Tout le journal est « sans nouveauté » : on montre au moins l'entrée courante.
    const courante = liste[depart]
    return { version, date: courante.date, html: html(blocs(courante.lignes)), courante: true, historique: [] }
  }
  const [note, ...historique] = utiles
  return { ...note, courante: note.version === version, historique }
}
