# Mes copropriétés

Le budget d'une copropriété achetée pour être louée, tenu à plusieurs. L'objectif
qu'elle sert : **l'autosuffisance** — que les loyers paient tout, ou presque.

## Ce qu'elle fait

- **Autosuffisance** : la part des sorties que les loyers couvrent, ce qui
  manque chaque mois, et ce qu'il faudrait pour atteindre 100 %.
- **Part de chacun** : ce qui manque est réparti selon les proportions des
  copropriétaires, par mois et par paie.
- **Revenus** : plusieurs logements, chacun avec son loyer, ses hausses datées
  (passées ou planifiées) et ses mois sans locataire.
- **Dépenses** : récurrentes (de la semaine à l'année) et ponctuelles, amorties
  sur 12 mois au besoin. Un montant se modifie « à partir de » un mois.
- **Hypothèque** : solde, taux, paiement, intérêts et capital, renouvellement.
- **Planification** : le solde du compte sur 13 mois, avec des ajustements
  ponctuels.
- **À plusieurs** : comptes par courriel ou Google, code d'invitation, données
  partagées en direct.
- **Notifications poussées**, et installation sur l'écran d'accueil.
- **Courriels** (Resend) : mot de passe oublié et vérification d'adresse,
  invitation par courriel, résumé le premier du mois.

## Comment elle compte

**Fonds de roulement** — ce qu'il faut chaque mois pour tout payer, chaque
dépense ramenée au mois :

| Dépense | Dans le fonds, par mois |
|---|---|
| Chaque semaine | montant × 52 ÷ 12 |
| Aux 2 semaines | montant × 26 ÷ 12 |
| Chaque mois | montant |
| Aux 3 mois | montant ÷ 3 |
| Une fois par an | montant ÷ 12 |
| Ponctuelle, amortie | montant ÷ 12, pendant 12 mois |
| Ponctuelle, non amortie | rien : payée à même le solde du compte |
| Hypothèque | paiement, ramené au mois |

**Autosuffisance** = loyers du mois ÷ fonds de roulement. Le capital de
l'hypothèque est compté dans les sorties : à 100 %, plus personne ne verse
rien. C'est une mesure de trésorerie, pas de rentabilité.

**Ce qui manque** = fonds de roulement − loyers (jamais sous zéro). Chacun en
verse sa proportion ; par paie, la part mensuelle est divisée par 4 (chaque
semaine), 2 (aux 2 semaines) ou 1 (chaque mois).

**Planification** — part du solde du compte saisi « au début d'un mois ».
Chaque mois : loyers et versements entrent ; les dépenses sortent **à leur
vraie date** (les taxes annuelles d'un coup, pas par douzièmes) ; les
ajustements s'ajoutent.

**Hypothèque** — intérêt composé semestriellement, comme le veut la règle
canadienne pour les prêts à taux fixe. Les paiements hebdomadaires ou aux deux
semaines sont ramenés à leur équivalent mensuel : c'est une approximation, que
ressaisir le solde recale.

Tous ces calculs sont dans `src/calc/budget.js`, avec leurs essais.

## Mise en ligne

Le site est servi par le NAS à `copropriete.ricard.app` ; comptes, base,
fonctions et notifications vivent chez Firebase ; les courriels partent par
Resend. **Toute la marche à suivre, pas à pas, est dans
[`deploy/README.md`](deploy/README.md)** : projet Firebase, connexion Google,
Resend, GitHub, NAS et tunnel Cloudflare.

Une fois en place, une fusion dans `main` part toute seule en production :

- **le site** : `web-image.yml` construit l'image sur GitHub Actions,
  watchtower l'installe sur le NAS dans les cinq minutes ;
- **le dos** : `firebase.yml` déploie règles et fonctions quand elles changent.

## Développement

```bash
npm install
npm install --prefix functions
cp .env.example .env.local      # VITE_EMULATEURS=1 et des valeurs factices suffisent

npx firebase-tools emulators:start --project demo-copro   # Auth, Firestore, Functions
npm run dev
```

Avec `VITE_EMULATEURS=1`, l'application parle aux émulateurs : aucun projet
réel, aucune donnée réelle. Les notifications poussées ne s'essaient pas ainsi
(l'émulateur n'en envoie pas) ; elles se vérifient sur le vrai projet. Les
courriels non plus : sans clé Resend, l'émulateur les écrit dans son journal
au lieu de les envoyer. Il lui faut `functions/.env.local` :

```
ADRESSE_APP=http://localhost:5173
EXPEDITEUR=Essai <essai@exemple.ca>
```

```bash
npm test          # les calculs et le contenu des courriels
npm run regles    # les règles Firestore (lance l'émulateur le temps de l'essai)
npm run fonctions # invitation et résumé mensuel, contre l'émulateur
npm run build
```

## Stack

React + Vite · Firebase (Auth, Firestore, Cloud Functions, Cloud Messaging) ·
Resend · NAS Synology (Caddy, tunnel Cloudflare) · GitHub Actions. Aucune police, aucun script ni aucune analytique
servis par un tiers ([`docs/empreinte-numerique.md`](docs/empreinte-numerique.md)).
