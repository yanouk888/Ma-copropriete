# Journal des versions

## 1.7.0 — 15 novembre 2026

- **Le nom de l'entreprise qui gère la propriété** titre maintenant la barre
  du haut (par exemple « Gestion Exemple inc. »), avec la propriété juste
  dessous. Il se saisit dans Réglages → Propriété, « Gérée par ».
- **Chaque propriété nomme ses propriétaires** : dans Réglages → Propriété,
  et dans « Mes copropriétés », sous chaque nom.
- **Vendre une part** : le gestionnaire inscrit le vendeur, l'acheteur et le
  mois. L'acheteur reprend la part ; le vendeur garde l'accès en lecture, et
  le rapport annuel répartit l'année entre les deux, au mois près.
- **Vendre la propriété** : elle passe en lecture seule, toujours consultable
  pour son rapport et ses pièces jointes, et sort de vos totaux. Une vente
  inscrite par erreur s'annule.
- **Plus besoin de code pour entrer** : après l'inscription, on arrive dans
  l'application, et on ajoute une propriété quand on veut.

## 1.6.0 — 15 novembre 2026

- **Un écran d'accueil** à l'ouverture, avec le logo, le temps que vos
  copropriétés se chargent.
- **La barre du haut dit où vous êtes** : le titre de la page, et juste
  dessous le nom de la copropriété ouverte — touchez-le pour en changer.
- **Une cloche** à droite garde l'historique de vos notifications, avec le
  nombre de non lues, même si les notifications sont coupées sur l'appareil.
- **Votre avatar** (votre photo Google, ou vos initiales) ouvre un menu :
  votre profil, les copropriétaires, les notifications, la déconnexion.
- **La barre du bas** garde Aperçu, Revenus, Dépenses et Suivi ; Planifier et
  Réglages sont sous « Plus ».
- **Les Réglages ont quatre onglets** : Profil, Copropriété, Notifications
  et À propos.

## 1.5.1 — 15 novembre 2026

- **L'application se met à jour toute seule**, comme Budget Maison : à
  l'ouverture, ou au retour après plus d'une minute ailleurs. Plus de
  bandeau « Mettre à jour » à toucher.
- **Une pastille « L'application a été mise à jour »** descend du haut de
  l'écran, quelques secondes, après chaque mise à jour. Touchez-la ou
  glissez-la vers le haut pour la renvoyer.
- **L'aperçu ne répète plus le nom de la copropriété** : il est dans la barre
  du haut. Sous le titre « Aperçu », les logements de la copropriété, chacun
  avec son loyer du mois.

## 1.5.0 — 15 novembre 2026

- **L'application s'appelle maintenant « Mes copropriétés »** : un compte peut
  en détenir plusieurs. Sous l'icône de l'écran d'accueil : « Mes copros »
  (après l'avoir réinstallée).
- **Le suivi des paiements**, dans le nouvel onglet Suivi. Chaque mois, les
  loyers, les dépenses et le paiement hypothécaire prévus attendent votre
  confirmation : le montant réellement payé, la date, le fournisseur, la
  TPS et la TVQ à titre d'information. « Pas payé » se note aussi.
- **Les pièces jointes** : une facture ou un reçu sur chaque paiement, le
  contrat d'une dépense, le bail d'un logement. PDF ou photo, gardés sur le
  serveur de la maison, visibles des seuls copropriétaires.
- **Le rapport annuel**, pour l'impôt : loyers reçus, dépenses classées selon
  les intitulés de l'état des loyers (T776 et TP-128), intérêts
  hypothécaires, dépenses en capital à part, et la part de chaque
  propriétaire. À imprimer en PDF ou à exporter pour le comptable.
- **Dépense courante ou en capital** : à préciser sur chaque dépense et
  chaque paiement ; une dépense en capital ne se déduit pas d'un coup.
- **Parts de propriété** : distinctes de la proportion des versements, elles
  servent au rapport. Le gestionnaire les règle dans Réglages.

## 1.4.0 — 15 novembre 2026

- **Une barre titre** en haut de chaque écran, avec le logo et la
  copropriété ouverte : touchez-la pour passer à une autre.
- **Un nouveau logo** : un immeuble dont le revenu monte. Il remplace aussi
  l'icône de l'écran d'accueil (à réinstaller pour la voir changer).
- **Lier votre compte Google** sous Réglages → Compte : ensuite, « Continuer
  avec Google » ouvre ce même compte, avec vos copropriétés, sans mot de passe.

## 1.3.0 — 15 novembre 2026

- **Plusieurs copropriétés.** Un logement avec un associé, un autre avec
  quelqu'un d'autre : chacun devient sa propre copropriété, avec ses dépenses, son
  hypothèque et son code d'invitation, et chaque co-investisseur ne voit que
  la sienne. Touchez le nom en haut de l'aperçu pour passer de l'une à
  l'autre, en ajouter une, et voir le total de votre part.
- **Les achats en versements.** Une armoire payée en 36 versements : entrez
  le total, le nombre et la fréquence, l'application compte « versement 7 sur
  36 » et arrête la dépense après le dernier.
- **L'adresse ne s'écrit qu'une fois.** En créant une copropriété, son
  premier logement est créé avec elle, sous le même nom, avec son loyer.
- **Continuer avec Google est en haut** de l'écran de connexion, visible
  sans défiler.

## 1.2.2 — 15 novembre 2026

- Rien ne change dans l'application : la mise en ligne se fait désormais en
  deux temps, le site sur le NAS d'abord, Google et les courriels ensuite.

## 1.2.1 — 15 novembre 2026

- Rien ne change dans l'application : la branche `main` est créée, et le guide
  de mise en ligne explique comment en faire la branche par défaut.

## 1.2.0 — 15 novembre 2026

- **Inviter par courriel.** Sous Réglages → Inviter, entrez une adresse : la
  personne reçoit le code et un bouton qui ouvre l'application avec le code
  déjà rempli. Dix invitations par jour au plus.
- **Un résumé par courriel le premier du mois** : taux d'autosuffisance,
  votre part, solde prévu, et une alerte si le compte va manquer. Il se coupe
  sous Réglages → Notifications.
- **Votre adresse est vérifiée** à la création du compte, par un courriel. Si
  elle ne l'est pas encore, Réglages → Compte propose de renvoyer le courriel.
- **Les courriels de Firebase sont en français** : mot de passe oublié et
  vérification d'adresse.
- **L'application déménage sur copropriete.ricard.app**, servie par le NAS.
  La connexion Google se fait désormais sous cette adresse, ce qui la rend
  fiable dans Safari et dans l'application installée sur l'iPhone.

## 1.1.0 — 15 novembre 2026

L'application devient visuelle, et elle bouge.

- **Un anneau d'autosuffisance** ouvre l'aperçu, sur une carte en couleur qui
  passe au vert quand la copropriété se paie toute seule.
- **Une courbe vers l'autosuffisance** montre le taux mois par mois sur 13
  mois, face à la ligne des 100 %. Glissez le doigt dessus pour lire un mois.
- **Où va l'argent** : sous Dépenses, une barre colorée répartit le fonds de
  roulement entre l'hypothèque, les frais de condo, les taxes et le reste.
  Chaque poste garde sa couleur et son icône partout.
- **Loyers contre sorties**, côte à côte sur la même échelle, dans l'aperçu
  et pour chaque mois de la planification.
- **Chaque logement montre ses 13 prochains mois** d'un coup d'œil : loué,
  vacant ou pas loué.
- **Les copropriétaires ont leur couleur**, et une barre montre le partage.
- **Du mouvement** : les cartes arrivent l'une après l'autre, les montants
  roulent jusqu'à leur valeur, les graphiques se dessinent, les fenêtres
  montent en ressort et repartent, la pilule de la barre du bas glisse. Avec
  « Réduire les animations » activé sur l'appareil, tout cela devient un
  fondu bref.
- **Corrigé** : il arrivait qu'on soit renvoyé à l'écran d'accueil juste après
  avoir créé ou rejoint une copropriété.

## 1.0.0 — 15 novembre 2026

Première version de Ma copropriété : le budget d'une copropriété achetée pour
la louer, tenu à plusieurs.

- **Autosuffisance.** L'aperçu dit quelle part des sorties les loyers
  couvrent, capital de l'hypothèque compris, ce qu'il manque chaque mois et ce
  qu'il faudrait pour atteindre 100 %.
- **Part de chacun.** Ce qui manque est réparti entre les copropriétaires
  selon leurs proportions, par mois et par paie.
- **Revenus.** Chaque logement a son loyer, ses hausses datées — passées ou
  planifiées — et ses mois sans locataire.
- **Dépenses et fonds de roulement.** Dépenses récurrentes, de la semaine à
  l'année, et dépenses ponctuelles, amorties sur 12 mois au besoin. Un montant
  se modifie « à partir de » un mois, sans réécrire le passé.
- **Hypothèque.** Solde, taux, paiement, part d'intérêts et de capital, date
  de renouvellement.
- **Planification.** Le solde du compte sur 13 mois, avec les paiements à
  leur vraie date et des ajustements ponctuels, entrées ou sorties.
- **À plusieurs.** Connexion par courriel ou avec Google ; un code
  d'invitation relie les copropriétaires, qui voient et modifient les mêmes
  données.
- **Notifications.** Part mensuelle qui change, autosuffisance atteinte, solde
  projeté sous zéro, nouvelle dépense, renouvellement de l'hypothèque, arrivée
  ou départ d'un copropriétaire — chacune peut se couper.
- **Installable** sur l'écran d'accueil, et utilisable hors ligne : une saisie
  faite sans réseau part au retour de la connexion.
