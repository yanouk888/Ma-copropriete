# Instructions pour Claude

## Ce qu'est ce projet

Application web (PWA) de budget pour une copropriété achetée pour être louée,
tenue à plusieurs copropriétaires : loyers par logement, dépenses récurrentes
et ponctuelles (amorties sur 12 mois au besoin), fonds de roulement,
hypothèque, planification sur 13 mois. **Le but de l'application est
l'autosuffisance** : que les loyers couvrent toutes les sorties, et sinon, dire
ce qui manque et ce que chacun verse.

Vite + React + Firebase (Auth, Firestore, Cloud Functions, FCM). Le site est
servi par **Vercel** ; le dos vit chez Firebase.

Écrite sur les principes de Budget Maison (dépôt voisin), mais repartie de
zéro et volontairement plus petite : avant d'ajouter une couche, se demander
si elle est nécessaire.

## Où sont les choses

- `src/calc/` — **tous les calculs**, en fonctions pures, sans React ni
  Firebase. C'est la seule source : l'interface et les Cloud Functions les
  partagent (`functions/copier-calculs.mjs` les recopie avant un déploiement).
  Un calcul ne s'écrit jamais ailleurs.
- `src/donnees/Session.jsx` — connexion, copropriété courante, écritures.
- `src/onglets/` — les cinq écrans. `src/composants/ui.jsx` — les briques.
- `firestore.rules` — le seul rempart entre les finances d'une copropriété et
  n'importe quel compte.
- `functions/` — les notifications poussées.

Le document `copros/{id}` porte toute une copropriété. Les montants des loyers
et des dépenses récurrentes sont des **paliers** `{ depuis, montant }` : on ne
réécrit pas le passé, on pose un nouveau montant « à partir de » un mois.

## Workflow git

- La branche par défaut est **`main`** ; les pull requests la visent.
- Quand le travail est terminé et poussé, créer la pull request et la
  **fusionner immédiatement**, sans demander de confirmation.

## Questions

Poser les questions de clarification **avant de se lancer**, quand une
réponse différente changerait le travail. Pour les poser, **privilégier le
sélecteur** (choix proposés à cliquer) plutôt qu'une question en texte libre :
on y répond d'un toucher, même depuis le téléphone.

## Numéro de version

**Toute fusion dans `main` monte le numéro**, même quand elle ne touche que la
documentation ou `CLAUDE.md` — un correctif, dans ce cas. Aucune mise à jour ne
passe sans numéro, sinon deux états du dépôt se confondent sous le même.

Avant de pousser, dans le même commit que le changement :

1. monter le champ `version` de `package.json` — source de vérité, format
   `MAJEUR.MINEUR.CORRECTIF` (correctif pour un bogue ou un ajustement visuel,
   mineur pour une fonctionnalité, majeur pour une refonte) ;
2. ajouter une entrée en tête de `CHANGELOG.md`, en français, décrivant le
   changement du point de vue de l'utilisateur.

L'entrée du `CHANGELOG.md` est **affichée dans l'application**, sous
**Réglages → À propos** (« Nouveautés de cette version »), tirée à la
compilation par `nouveautes.mjs` : l'écrire pour qui la lira à l'écran. La
compilation échoue si la version n'a pas d'entrée — c'est voulu. Une version
qui ne change rien à l'écran le dit dans **chacun** de ses points (« Rien ne
change… ») : la note remonte alors à la dernière vraie nouveauté.

`vite.config.js` injecte le numéro dans le bundle et dans `dist/version.json`.
Il n'y a pas de `/health` : cette application n'a pas d'API à elle.

Si `main` a reçu une autre version entre-temps, prendre le numéro **suivant**
celui de `main` et placer son entrée au-dessus : un numéro publié ne se
réutilise ni ne s'écrase.

## Commentaires

En français, et ils expliquent **pourquoi**, pas **quoi** — y compris dans les
fichiers de configuration et les messages de commit.

## Langue

Tout est en français : interface, commentaires, messages de commit,
documentation, journal des versions, **et les identifiants de code** (c'est
l'usage de ce dépôt-ci). Seuls restent en anglais les noms imposés par
Firebase et React, et trois champs repris de Budget Maison pour que les deux
dépôts se lisent de la même façon : `memberUids`, `members`, `displayName`.

## Déploiement

- **Le site** : Vercel le construit et le publie à chaque poussée
  (`vercel.json`). La configuration Firebase lui vient de variables
  d'environnement (`.env.example`) — jamais du code.
- **Le dos Firebase** : `.github/workflows/firebase.yml` déploie les règles et
  les fonctions quand `functions/`, `src/calc/`, `firestore.rules` ou
  `firebase.json` changent.

Le service worker (`public/sw.js`) ne charge **pas** le SDK Firebase et ne met
rien en cache : il lit l'événement `push` directement. Ne pas y ramener
d'`importScripts` vers un CDN.

## Avant de fusionner

Comme tout est fusionné dans `main` sans attendre, ce qui suit est le seul
garde-fou entre une erreur et la production. **Si une vérification échoue, on
ne fusionne pas** : on corrige d'abord.

```
npm test          # les calculs
npm run build
npm run regles    # les règles Firestore, contre l'émulateur (si elles ont changé)
```

L'interface se vérifie **dans un vrai navigateur**, contre les émulateurs
(`README.md` → Développement), pas seulement à la compilation :

- **on touche, on ne force pas** : un état posé à la main dans le DOM prouve
  seulement que le DOM accepte d'être écrit ;
- **à deux comptes** dès qu'on touche au partage : ce qu'écrit l'un doit
  paraître chez l'autre sans recharger ;
- **aucune erreur de page** n'est tolérée : chaque écran visité avec une
  oreille sur `pageerror` et sur la console ;
- **rien ne déborde**, mesuré à 360, 390 et 430 px — la largeur des vrais
  téléphones, pas celle de la fenêtre de travail ;
- **un essai intermittent est un défaut**, pas de la malchance : on le
  relance jusqu'à comprendre.

## Empreinte numérique

Deux documents portent ces règles. **Ils sont portables : les recopier dans
chaque nouveau projet.**

- [`docs/empreinte-numerique.md`](docs/empreinte-numerique.md) — les règles
  générales, valables partout.
- [`docs/nom-de-domaine.md`](docs/nom-de-domaine.md) — ce qui est propre à
  `ricard.app`, et la liste de vérification.

Les trois qui ne se négocient pas :

1. **Rien n'est référencé.** En-tête `X-Robots-Tag: noindex, nofollow,
   noarchive, nosnippet` sur chaque réponse (`vercel.json`), balise
   `<meta name="robots">` dans chaque page. Et **jamais `Disallow: /` dans
   `robots.txt`** : ça empêche le robot de lire le `noindex`, ce qui produit
   exactement l'inverse de l'effet voulu.
2. **Aucune donnée réelle** dans les maquettes, les jeux d'essai ou les
   captures : noms inventés, adresses en `@exemple.ca`, jetons factices. Aucun
   courriel personnel dans les commits.
3. **Le nom de domaine n'est jamais écrit en dur.** Ni lui, ni la
   configuration Firebase : des variables d'environnement.
