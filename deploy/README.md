# Mettre Mes copropriétés en ligne

Le guide complet, dans l'ordre, pour servir l'application à
**`copropriete.ricard.app`** depuis le NAS, comme Budget Maison.

Chaque étape dit **où cliquer**, **quoi écrire**, et **comment vérifier**
avant de passer à la suivante. Cochez au fur et à mesure.

> **À savoir avant de commencer.** Ce guide a été écrit et vérifié depuis le
> code et les émulateurs Firebase, **pas sur un vrai projet** : les libellés
> des consoles Google et Resend peuvent différer un peu de ceux cités ici
> (ils changent souvent), et les étapes marquées ⚠️ n'ont pas pu être essayées
> pour de vrai. Quand quelque chose ne correspond pas, la section
> [Dépannage](#dépannage) dit quoi regarder.

---

## Vue d'ensemble

```
                          ┌──────────────── Firebase (Google) ─────────────────┐
 téléphone ──https──▶ Cloudflare ──tunnel ds923──▶ NAS                           │
                          │                    copropriete-web (Caddy)         │
                          │                     ├─ les fichiers du site        │
                          │                     └─ /__/auth/ ──relais──▶ connexion Google
 téléphone ──────────────────────────────────▶ Auth · Firestore · Functions · FCM
                                                         │
                                                         └──▶ Resend ──▶ courriels
```

| Brique | Où elle vit | Ce qu'elle fait |
|---|---|---|
| Fichiers du site | NAS, conteneur `copropriete-web` | l'application elle-même |
| Comptes, base de données | Firebase (Auth, Firestore) | connexion, données partagées |
| Fonctions | Firebase (Cloud Functions) | notifications, invitation, résumé mensuel |
| Notifications poussées | Firebase Cloud Messaging | les alertes sur le téléphone |
| Courriels | Resend, domaine `ricard.app` | mot de passe oublié, invitation, résumé |
| Construction | GitHub Actions | compile, publie l'image, déploie Firebase |

### En deux temps

**Phase 1 — le site sur le NAS**, avec Firebase au forfait gratuit : on s'y
connecte par courriel et mot de passe, et les données sont partagées. Pas de
connexion Google, pas de courriels Resend, pas de notifications.

| Étape | Phase 1 |
|---|---|
| 1 Projet Firebase | oui, **sans** 1.1 (Blaze) |
| 2 Connexion | 2.1 et 2.3 seulement |
| 3 Firestore | oui, **avec 3.1** (règles collées à la main) |
| 4 Application Web | 4.1 seulement |
| 5 Google, 6 Resend | non |
| 7 GitHub | 7.1 (fait) et les **5 premières variables** de 7.3 |
| 8 Déploiement | **8.2 seulement** (l'image) |
| 9 NAS et tunnel | oui |
| 10 Vérifications | lignes 1, 3, 4 et 8, en se connectant par courriel |

**Phase 2 — Google, Resend, notifications** : tout le reste (1.1, 2.2, 2.4,
4.2, 5, 6, 7.2, la fin de 7.3, 8.1), puis l'étape 10 au complet.

**Ce qui se fait une seule fois** : les étapes 1 à 9. **Ensuite**, toute
fusion dans `main` part en production toute seule (voir [Mettre à
jour](#mettre-à-jour-lapplication)).

**Durée** : compter environ deux heures, dont une bonne part d'attente.

**Pas de nom d'essai**, contrairement à Budget Maison : l'application n'a
encore aucun utilisateur, on peut la mettre directement sous son vrai nom.

### Ce qu'il vous faut

- un compte Google (celui qui possédera le projet Firebase) ;
- une carte de crédit pour le forfait Blaze de Firebase (voir [Coûts](#coûts)) ;
- les accès : Resend, Cloudflare (Zero Trust), GitHub, DSM du NAS ;
- un bloc-notes pour garder les valeurs à recopier. Le tableau de
  l'[annexe](#annexe--les-valeurs-à-garder) les liste toutes.

---

## Étape 1 — Créer le projet Firebase

1. Ouvrir **https://console.firebase.google.com** → **Créer un projet**.
2. Nom : **`Ma copropriete`**. Firebase propose un identifiant dessous
   (par exemple `ma-copropriete-1a2b3`) : **le noter**, c'est
   l'**identifiant du projet**, il servira partout.
3. **Google Analytics : désactiver.** Aucune analytique
   (`docs/empreinte-numerique.md`).
4. Créer, attendre, **Continuer**.

### 1.1 Passer au forfait Blaze

Les fonctions (notifications, courriels) et Secret Manager l'exigent.

1. En bas à gauche : **Spark** → **Mettre à niveau** → **Blaze**.
2. Choisir ou créer un compte de facturation.
3. **Fixer une alerte de budget** quand Firebase le propose : **5 $** suffit
   largement. Ce n'est pas un plafond, c'est un courriel d'avertissement.

✅ **Vérifier** : en bas à gauche, le forfait affiché est **Blaze**.

---

## Étape 2 — Activer la connexion

### 2.1 Courriel et mot de passe

1. Menu de gauche **Créer → Authentication** → **Commencer**.
2. Onglet **Mode de connexion** → **Adresse e-mail/Mot de passe** →
   **Activer** (le premier interrupteur seulement ; pas « Lien par e-mail »)
   → **Enregistrer**.

### 2.2 Google

1. Même onglet → **Ajouter un fournisseur** → **Google** → **Activer**.
2. **Nom public du projet** : **`Mes copropriétés`**. C'est ce que Google
   affichera dans sa fenêtre de connexion.
3. **Adresse e-mail d'assistance** : la vôtre.
4. **Enregistrer**.

### 2.3 Domaines autorisés

1. Onglet **Paramètres** → **Domaines autorisés** → **Ajouter un domaine**.
2. Écrire **`copropriete.ricard.app`** → **Ajouter**.

Sans lui, la connexion Google répond `auth/unauthorized-domain`.

### 2.4 Langue des courriels de compte

Onglet **Modèles** → en bas, **Langue des modèles** (icône crayon) →
**Français**. Le code demande aussi le français (`auth.languageCode`), mais
le réglage de console fait foi pour les modèles.

✅ **Vérifier** : *Mode de connexion* liste **Adresse e-mail/Mot de passe**
et **Google**, tous deux **Activé**.

---

## Étape 3 — Créer la base Firestore

1. **Créer → Firestore Database** → **Créer une base de données**.
2. **ID de base de données** : laisser **`(default)`**.
3. **Emplacement** : **`nam5 (United States)`**.
   > Pourquoi pas Montréal ? Les fonctions tournent à `us-central1`, et
   > `nam5` est l'emplacement que Firebase associe à cette région pour les
   > déclencheurs Firestore. Un autre emplacement risquerait de faire
   > échouer le déploiement des fonctions. **Ce choix est définitif.**
4. **Démarrer en mode production** → **Créer**.

### 3.1 Coller les règles

En phase 1, rien ne déploie les règles automatiquement (il faudrait le compte
de déploiement de la phase 2). On les colle donc une fois, à la main.

1. Ouvrir sur GitHub le fichier **`firestore.rules`** du dépôt (branche
   `main`) → bouton **Copy raw file** (icône de copie, en haut à droite du
   fichier).
2. Console Firebase → **Firestore Database** → onglet **Règles**.
3. Tout sélectionner dans l'éditeur, **coller** par-dessus → **Publier**.

✅ **Vérifier** : l'éditeur commence par `rules_version = '2';` et contient
`match /copros/{coproId}`. En haut, la date de publication est celle
d'aujourd'hui.

> Retour arrière : l'onglet Règles garde l'historique des versions publiées.
> À la phase 2, le workflow republiera ce même fichier à chaque changement.

---

## Étape 4 — Déclarer l'application Web et noter sa configuration

### 4.1 L'application Web

1. Roue dentée en haut à gauche → **Paramètres du projet** → onglet
   **Général**.
2. En bas, **Vos applications** → icône **`</>`** (Web).
3. Surnom : **`copropriete-web`**. **Ne pas** cocher Firebase Hosting.
4. **Enregistrer l'application**. Firebase affiche un bloc
   `const firebaseConfig = { … }`. **Noter** :

| Dans le bloc | Nom de la variable GitHub (étape 7) |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `projectId` | `FIREBASE_PROJECT_ID` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

**Ne pas** recopier `authDomain` : il vaudra **`copropriete.ricard.app`**,
et non `….firebaseapp.com` (étape 5 — c'est ce qui rend la connexion Google
fiable).

> Ces valeurs ne sont **pas des secrets** : elles finissent dans le site, que
> tout navigateur télécharge. Ce sont les règles Firestore qui protègent les
> données.

### 4.2 La clé des notifications poussées (VAPID)

1. **Paramètres du projet** → onglet **Cloud Messaging**.
2. Section **Configuration Web** → **Certificats Web Push** → **Générer une
   paire de clés**.
3. **Noter** la longue chaîne affichée : c'est **`VITE_FIREBASE_VAPID_KEY`**.

### 4.3 Ne pas restreindre la clé d'API par référent

Le site envoie `Referrer-Policy: no-referrer` (aucun clic sortant ne dit d'où
il vient). Si un jour vous restreignez la clé d'API dans Google Cloud, **ne
choisissez pas « Référents HTTP »** : la clé ne recevrait plus de référent et
tout serait refusé.

---

## Étape 5 — Connexion Google sous votre propre adresse

### Pourquoi cette étape

Par défaut, la fenêtre de connexion Google est servie par
`<projet>.firebaseapp.com`, un domaine différent du site. Safari (et de plus
en plus Chrome) cloisonne ce qu'un site tiers garde dans le navigateur : la
connexion Google peut alors échouer **sans aucun message**, surtout dans
l'application installée sur l'écran d'accueil d'un iPhone.

La parade est documentée par Firebase (« option 3 » de la page sur les
navigateurs qui bloquent le stockage tiers) : le NAS **relaie** les adresses
`/__/auth/…` vers Firebase, et la connexion se fait sous
`copropriete.ricard.app`. C'est déjà écrit dans `deploy/Caddyfile` ; il reste
à le dire à Google. Bonus : la fenêtre Google affiche « Continuer vers
copropriete.ricard.app » au lieu d'un nom de projet obscur.

### 5.1 Autoriser l'adresse de retour

1. Ouvrir **https://console.cloud.google.com** et choisir le projet (même
   nom que dans Firebase, en haut à gauche).
2. Menu **API et services → Identifiants**.
3. Sous **ID clients OAuth 2.0**, ouvrir **Web client (auto created by
   Google Service)** — créé par Firebase à l'étape 2.2.
4. **URI de redirection autorisés** → **Ajouter un URI** :
   **`https://copropriete.ricard.app/__/auth/handler`**
5. **Origines JavaScript autorisées** → **Ajouter un URI** :
   **`https://copropriete.ricard.app`**
6. **Enregistrer**. La prise en compte peut prendre **quelques minutes à
   quelques heures**.

### 5.2 L'écran de consentement

1. Même console → **API et services → Écran de consentement OAuth** (ou
   **Google Auth Platform → Branding**, selon la version de la console).
2. **Nom de l'application** : `Mes copropriétés`. **Adresse d'assistance** : la
   vôtre.
3. **Domaines autorisés** : ajouter **`ricard.app`**.
4. **Ne pas** téléverser de logo : un logo déclenche une vérification par
   Google, longue et inutile ici.
5. **Audience / État de publication** : il doit être **En production**. S'il
   est **En test**, seuls les comptes listés comme testeurs pourraient se
   connecter : **Publier l'application**. Les seules informations demandées
   (courriel, nom, photo) n'exigent aucune vérification par Google.

### 5.3 ⚠️ Vérifier que Firebase sert bien la page de connexion

Ouvrir dans un navigateur :
**`https://<identifiant du projet>.firebaseapp.com/__/auth/handler`**

- Une page blanche, ou un court message d'erreur technique : **bien**, la
  page existe.
- **« Site Not Found »** : le site Firebase par défaut n'existe pas encore.
  Console Firebase → **Créer → Hosting** → **Commencer**, suivre les écrans
  **sans rien déployer**, puis réessayer l'adresse.

⚠️ **Ne jamais désactiver Firebase Hosting** ensuite : le relais du NAS
pointe vers cette page.

✅ **Vérifier** : l'URI de redirection apparaît dans le client OAuth, l'écran
de consentement est **En production**.

---

## Étape 6 — Resend

Le domaine `ricard.app` est déjà vérifié dans Resend : il n'y a rien à
ajouter dans le DNS. Deux usages, **deux clés** — pour pouvoir en révoquer
une sans couper l'autre :

| Clé | Qui l'utilise | Pour quels courriels |
|---|---|---|
| `copropriete-smtp` | Firebase Authentication | mot de passe oublié, vérification d'adresse |
| `copropriete-fonctions` | les Cloud Functions | invitation par courriel, résumé mensuel |

### 6.1 Créer les deux clés

1. **https://resend.com** → **API Keys** → **Create API Key**.
2. Nom **`copropriete-smtp`**, permission **Sending access**, domaine
   **`ricard.app`** → **Add**. **Copier la clé** (`re_…`) tout de suite :
   Resend ne la remontrera plus.
3. Recommencer pour **`copropriete-fonctions`**, mêmes réglages.

Gardez-les dans votre gestionnaire de mots de passe, **jamais** dans un
courriel, une note partagée ou le dépôt.

### 6.2 Couper le suivi des ouvertures et des clics

Resend peut ajouter un pixel espion et réécrire les liens pour savoir qui a
ouvert quoi. On n'en veut pas (`docs/empreinte-numerique.md`), et des liens
réécrits rendraient le bouton d'invitation suspect aux yeux des filtres.

**Domains** → **`ricard.app`** → **Configuration** (ou *Settings*) →
**Click tracking : off**, **Open tracking : off**.

> Ce réglage vaut pour tout le domaine, donc aussi pour les autres
> applications qui envoient depuis `ricard.app`. Vérifiez qu'aucune ne s'en
> sert avant de le couper.

### 6.3 Courriels de compte : Firebase envoie par Resend

Sans ce réglage, « mot de passe oublié » part de `noreply@<projet>.firebaseapp.com`,
qui finit souvent dans les indésirables.

1. Console Firebase → **Authentication → Modèles** → **Paramètres SMTP**
   (en bas de la liste des modèles).
2. **Activer** et remplir :

| Champ | Valeur |
|---|---|
| Adresse de l'expéditeur | **`copropriete@ricard.app`** |
| Hôte du serveur SMTP | **`smtp.resend.com`** |
| Port du serveur SMTP | **`465`** |
| Nom d'utilisateur SMTP | **`resend`** (le mot, tel quel, en minuscules) |
| Mot de passe SMTP | la clé **`copropriete-smtp`** (`re_…`, sans espace autour) |
| Mode de sécurité SMTP | **SSL** |

3. **Enregistrer**.

> Si **Paramètres SMTP** n'apparaît pas dans votre console, n'insistez pas :
> tout le reste fonctionne, les courriels de compte partiront simplement de
> l'adresse Firebase par défaut.

### 6.4 Les modèles de courriel

Toujours dans **Modèles**, pour **Validation de l'adresse e-mail** puis
**Réinitialisation du mot de passe** (crayon) :

- **Nom de l'expéditeur** : `Mes copropriétés`
- **Répondre à** : votre adresse, si vous voulez recevoir les réponses
- **Objet** : par exemple « Vérifiez votre adresse pour Mes copropriétés » et
  « Nouveau mot de passe pour Mes copropriétés »
- **Enregistrer**.

### 6.5 (Facultatif) Des liens à votre adresse dans ces courriels

Par défaut, le lien du courriel mène à `<projet>.firebaseapp.com/__/auth/action`.
Comme le NAS relaie `/__/auth/`, il peut mener à votre adresse :

**Modèles** → un modèle → crayon → **Personnaliser l'URL d'action** →
**`https://copropriete.ricard.app/__/auth/action`** → **Enregistrer**.
⚠️ Non essayé : si le lien d'un courriel de test ne fonctionne pas, remettez
l'URL par défaut.

### 6.6 La clé des fonctions va dans Secret Manager

La clé `copropriete-fonctions` ne va **ni dans GitHub ni dans le dépôt** :
dans le coffre de Google, où seules les fonctions la lisent.

1. **https://console.cloud.google.com** → bon projet → menu **Sécurité →
   Secret Manager**. Si Google le propose : **Activer** l'API.
2. **Créer un secret**.
3. **Nom** : **`RESEND_API_KEY`** — exactement, en majuscules : le code le
   cherche sous ce nom.
4. **Valeur du secret** : coller la clé `copropriete-fonctions`.
5. Laisser le reste par défaut → **Créer le secret**.

✅ **Vérifier** : Secret Manager liste `RESEND_API_KEY`, version 1, activée.

---

## Étape 7 — GitHub

### 7.1 La branche par défaut

La branche `main` existe ; c'est elle que déploient les workflows. Mais la
branche **par défaut** du dépôt est encore `claude/copropriete-budget-app-83z7sa`,
la première poussée.

1. **GitHub → yanouk888/Ma-copropriete → Settings → General**.
2. Section **Default branch** → icône des deux flèches (*Switch to another
   branch*) → choisir **`main`** → **Update** → confirmer.

Sans cela, l'onglet Actions et les pull requests partent de la mauvaise
branche. Tant que la configuration n'est pas saisie (7.3), une poussée sur
`main` ne construit rien : les workflows attendent, sans échouer.

### 7.2 Le compte de déploiement

GitHub Actions déploie les règles et les fonctions à votre place ; il lui
faut un compte de service Google.

1. **console.cloud.google.com** → bon projet → **IAM et administration →
   Comptes de service** → **Créer un compte de service**.
2. Nom : **`deploiement-github`** → **Créer et continuer**.
3. **Rôles** — ajouter chacun :
   - **Administrateur Firebase** (*Firebase Admin*)
   - **Administrateur Cloud Functions** (*Cloud Functions Admin*)
   - **Utilisateur du compte de service** (*Service Account User*)
   - **Administrateur Cloud Scheduler** (*Cloud Scheduler Admin*) — pour le
     rappel quotidien et le résumé mensuel
   - **Administrateur de Secret Manager** (*Secret Manager Admin*) — pour
     donner aux fonctions l'accès à la clé Resend
   - **Administrateur Artifact Registry** (*Artifact Registry Administrator*)
   - **Consommateur Service Usage** (*Service Usage Consumer*)

   ⚠️ Cette liste réunit ce qu'exigent d'ordinaire les fonctions de 2ᵉ
   génération, les tâches planifiées et les secrets ; elle n'a pas pu être
   essayée sur un vrai projet. Si le premier déploiement échoue sur
   `Permission denied` ou `does not have permission`, le journal nomme la
   permission manquante : ajoutez le rôle qui la contient et relancez.
4. **OK**. Ouvrir le compte créé → onglet **Clés** → **Ajouter une clé →
   Créer une clé → JSON**. Un fichier `.json` se télécharge.

> Ce fichier donne la main sur le projet. Ne l'envoyez à personne, ne le
> laissez pas traîner dans *Téléchargements* : effacez-le après l'étape 7.3.

### 7.3 Les variables et le secret du dépôt

**GitHub → dépôt → Settings → Secrets and variables → Actions**.

Onglet **Secrets** → **New repository secret** :

| Nom | Valeur |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | tout le contenu du fichier `.json` de l'étape 7.2 |

Onglet **Variables** → **New repository variable**, une par ligne :

| Nom | Valeur |
|---|---|
| `FIREBASE_PROJECT_ID` | l'identifiant du projet (étape 1) |
| `VITE_FIREBASE_API_KEY` | `apiKey` (étape 4.1) |
| `VITE_FIREBASE_AUTH_DOMAIN` | **`copropriete.ricard.app`** |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` (étape 4.1) |
| `VITE_FIREBASE_APP_ID` | `appId` (étape 4.1) |
| `VITE_FIREBASE_VAPID_KEY` | la clé Web Push (étape 4.2) — *phase 2* |
| `ADRESSE_APP` | **`https://copropriete.ricard.app`** (sans `/` à la fin) — *phase 2* |
| `EXPEDITEUR` | **`Mes copropriétés <copropriete@ricard.app>`** — *phase 2* |
| `DEPLOIEMENT_FIREBASE` | **`tout`** — *phase 2, en dernier* : c'est elle qui autorise le workflow **Firebase** à déployer règles et fonctions |

Des **variables** et non des secrets, sauf le compte de service : ces
valeurs sont publiques, et une variable se relit, ce qui aide à repérer une
faute de frappe. Le domaine n'est ainsi écrit nulle part dans le code : le
jour où il change, on change deux variables et on relance.

✅ **Vérifier** : en phase 1, 5 variables et aucun secret. En phase 2,
1 secret et 9 variables ; effacer alors le fichier `.json` de votre
ordinateur.

---

## Étape 8 — Premier déploiement

### 8.1 Les règles et les fonctions

1. **GitHub → Actions → Firebase → Run workflow** → branche `main` → **Run**.
2. Attendre le vert (5 à 10 minutes la première fois : Google active ses
   services au passage).

✅ **Vérifier** : console Firebase → **Functions** liste
`inviterParCourriel`, `onCoproModifiee`, `rappelsQuotidiens`,
`resumeMensuel`. **Firestore → Règles** montre les vraies règles (plus
« tout refusé »).

### 8.2 L'image du site

1. **Actions → Image du site → Run workflow** → `main` → **Run**.
2. Attendre le vert (3 à 5 minutes).

✅ **Vérifier** : **profil GitHub → Packages → `copropriete-web`**. Le paquet
reste **privé** ; le NAS s'y identifie déjà (le `docker login ghcr.io` fait
pour Groupe Loto et Budget Maison).

---

## Étape 9 — Le NAS et le tunnel

### 9.1 Installer le conteneur

1. **File Station** → dossier partagé `docker` → créer **`copropriete`** (en
   minuscules : le nom suit l'adresse, comme `budget` et `watchlist`).
2. Y déposer **`docker-compose.yml`** (celui de ce dossier `deploy/`).
   > ⚠️ Vérifier le nom après dépôt : les traits d'union disparaissent des
   > fichiers téléchargés depuis GitHub (`docker-compose.yml` devient
   > `dockercompose.yml`), et Container Manager ne trouverait rien.
3. **Container Manager → Projet → Créer** : nom **`copropriete`**, chemin
   **`/volume1/docker/copropriete`**, source **Utiliser le
   docker-compose.yml existant** → **Suivant** → **Terminé**.

✅ **Vérifier** : le conteneur **`copropriete-web`** est vert, avec du CPU et
de la RAM au-dessus de zéro.

### 9.2 La route du tunnel

Cloudflare → **Zero Trust** → **Networks** → **Tunnels** (ou *Tunnels &
Mesh*) → **`ds923`** → **Published application routes** → **Add** :

| Champ | Valeur |
|---|---|
| Subdomain | **`copropriete`** |
| Domain | **`ricard.app`** |
| Service | **HTTP** → **`copropriete-web:80`** |

Le nom **complet** du conteneur, et **HTTP**, jamais HTTPS : Cloudflare
chiffre jusqu'au NAS, le conteneur n'a pas de certificat. Cloudflare crée
l'enregistrement DNS tout seul.

✅ **Vérifier** : `https://copropriete.ricard.app` affiche l'écran de
connexion (les immeubles dont les fenêtres s'allument).

---

## Étape 9 bis — Les pièces jointes (à partir de la 1.5.0)

Les factures, baux et photos sont gardés **sur le NAS**, dans le dossier
`fichiers/` du projet, par un second conteneur : `copropriete-api`. Il n'a
aucun secret : il vérifie le jeton de connexion de la personne et demande à
Firestore si elle est membre de la copropriété.

1. **File Station** → `docker/copropriete` → **Créer → Créer un dossier** →
   **`fichiers`**. ⚠️ Avant l'étape 3 : sinon Docker le crée lui-même, au
   nom de root, et File Station ne pourra plus l'ouvrir.
2. Remplacer **`docker-compose.yml`** par la nouvelle version (celle de ce
   dossier `deploy/`, qui contient le service `api`). Vérifier le nom après
   dépôt (traits d'union).
3. Appliquer le compose par le **Planificateur de tâches** (Container Manager
   ne sait pas le faire ; voir le README de `NAS_923_infrastructure`) :
   tâche planifiée, utilisateur **`root`**, *Enregistrer le résultat* coché,
   script :

   ```sh
   cd /volume1/docker/copropriete && /usr/local/bin/docker compose -p copropriete up -d --remove-orphans
   ```

   Cliquer sur le **nom** de la tâche, **Exécuter**, puis *Afficher le
   résultat*.
4. ✅ Vérifier : `https://copropriete.ricard.app/api/health` répond
   `{"ok":true,"version":"…"}` avec la version affichée dans l'application.
5. **Hyper Backup** : ajouter `docker/copropriete/fichiers` à la sauvegarde.
   Les pièces jointes n'existent **que** là.

Retour arrière : remettre l'ancien `docker-compose.yml` et relancer la même
tâche. Le site ne dépend pas de l'API : sans elle, seules les pièces jointes
cessent de fonctionner.

Aucune route de tunnel à ajouter : le site relaie `/api/` vers l'API par le
réseau `edge` (`deploy/Caddyfile`).

---

## Étape 10 — Tout vérifier, dans l'ordre

Sur le téléphone, puis sur un second appareil avec un second compte.

| # | Geste | Attendu |
|---|---|---|
| 1 | Ouvrir `https://copropriete.ricard.app` | l'écran de connexion |
| 2 | **Continuer avec Google** | la fenêtre Google dit « Continuer vers copropriete.ricard.app » ; on revient connecté |
| 3 | Créer une copropriété | l'aperçu vide « Tout commence ici » |
| 4 | **Réglages → À propos** | **Version installée : 1.2.0** |
| 5 | Se déconnecter, **Créer un compte** par courriel | un courriel « vérifiez votre adresse » arrive, **de `copropriete@ricard.app`** |
| 6 | Se déconnecter, **Mot de passe oublié** | le courriel arrive, de la même adresse, en français |
| 7 | **Réglages → Inviter par courriel**, vers votre autre adresse | l'invitation arrive ; son bouton ouvre l'application avec le code déjà rempli |
| 8 | Second compte : **Rejoindre** | les deux comptes voient les mêmes données ; une modification chez l'un paraît chez l'autre sans recharger |
| 9 | **Réglages → Notifications → Recevoir les notifications** | le téléphone demande la permission ; puis, si l'autre compte ajoute une dépense, une notification arrive |
| 10 | Installer sur l'écran d'accueil, puis refaire 2 depuis l'icône | la connexion Google marche aussi dans l'application installée |

**iPhone** : les notifications n'existent que dans l'application
**installée** (Safari → Partager → Sur l'écran d'accueil), puis ouverte
depuis son icône. C'est une règle d'Apple, pas un défaut.

Le **résumé mensuel** partira le **1ᵉʳ du mois suivant à 8 h**. Pour le
vérifier plus tôt : console Google Cloud → **Cloud Scheduler** →
`firebase-schedule-resumeMensuel-…` → **⋮ → Forcer l'exécution**. Il n'écrit
qu'aux copropriétaires d'une copropriété qui a au moins une sortie saisie.

---

## Mettre à jour l'application

```
fusion dans main ─┬─▶ « Image du site » publie l'image ─▶ watchtower l'installe (5 à 10 min)
                  └─▶ « Firebase » redéploie règles et fonctions, si elles ont changé
```

Rien à faire sur le NAS. Les téléphones affichent **« Une nouvelle version
est disponible »** au retour dans l'application.

- **Changer une variable** (étape 7.3) : relancer les deux workflows à la
  main (**Run workflow**).
- **Changer la clé Resend des fonctions** : Secret Manager → `RESEND_API_KEY`
  → **Nouvelle version**, puis relancer le workflow **Firebase** (les
  fonctions lisent la clé à leur démarrage).
- **Geler une version** : dans le compose, remplacer `:latest` par le numéro
  (`:1.2.0`).
- **Appliquer un compose modifié** : voir « Appliquer un changement de
  compose » dans le README de `NAS_923_infrastructure` (Container Manager ne
  sait pas réappliquer un compose à un projet existant).

---

## Dépannage

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| « Bad gateway » | la route désigne autre chose que `copropriete-web:80`, ou le conteneur n'est pas sur `edge` | revoir 9.2 ; vérifier que le conteneur est vert |
| « Configuration manquante » à l'écran | l'image a été construite sans les variables | 7.3, puis relancer **Image du site** |
| Le workflow **Image du site** échoue sur « Configuration Firebase absente » | une variable manque ou est mal nommée | comparer au tableau 7.3, à la lettre près |
| La fenêtre Google s'ouvre puis affiche `redirect_uri_mismatch` | l'URI de 5.1 manque, ou n'est pas encore prise en compte | vérifier 5.1 à la lettre ; attendre une heure |
| La fenêtre Google affiche « Site Not Found » | le site Firebase par défaut n'existe pas | 5.3 |
| `auth/unauthorized-domain` | l'adresse manque dans les domaines autorisés | 2.3 |
| Google refuse : « accès bloqué », « application en test » | écran de consentement en test | 5.2, **Publier** |
| Connecté par courriel, mais la connexion Google tourne dans le vide sur iPhone | ancienne page en cache, ou `VITE_FIREBASE_AUTH_DOMAIN` vaut encore `….firebaseapp.com` | vérifier la variable, relancer l'image, fermer et rouvrir l'app |
| Aucun courriel de compte n'arrive | SMTP mal réglé (6.3) | Resend → **Logs** : rien n'apparaît = Firebase n'a pas joint Resend (port, mode SSL, utilisateur `resend`, clé entière) ; une erreur = domaine ou clé |
| Les courriels arrivent dans les indésirables | l'expéditeur n'est pas sur le domaine vérifié | 6.3 et `EXPEDITEUR` : bien `@ricard.app` |
| « Le courriel n'a pas pu partir » en invitant | clé absente ou refusée | Secret Manager (6.6) ; console Firebase → **Functions → Journaux** → `inviterParCourriel` : le message de Resend y est |
| « Pas plus de 10 invitations par jour » | le plafond, voulu : il protège la réputation du domaine | attendre le lendemain, ou donner le code de vive voix |
| Le workflow **Firebase** échoue sur `Permission denied` | rôle manquant au compte de déploiement | le journal nomme la permission : 7.2 |
| Le workflow **Firebase** échoue sur `RESEND_API_KEY` | le secret n'existe pas ou porte un autre nom | 6.6, nom exact |
| Le workflow **Firebase** échoue sur `ADRESSE_APP` ou `EXPEDITEUR` | variable absente | 7.3 |
| Les notifications n'arrivent pas | permission refusée sur l'appareil, ou iPhone hors de l'app installée | Réglages → Notifications ; sur iPhone, depuis l'icône de l'écran d'accueil |
| La version affichée ne bouge pas après un déploiement | watchtower n'a pas encore tiré l'image, ou le jeton GHCR du NAS a expiré | journal de `infra-watchtower` |
| Le projet `copropriete` est rouge, tout le reste est vert | comptabilité de Container Manager après un `docker compose` lancé hors de lui | voir le README de `NAS_923_infrastructure` |

---

## Coûts

Ordres de grandeur pour quelques copropriétaires ; vérifiez les grilles
actuelles, elles changent.

| Service | Ce qu'on en utilise | Coût attendu |
|---|---|---|
| Firebase Auth, Firestore, FCM | quelques comptes, quelques milliers de lectures par mois | 0 $ (dans le palier gratuit) |
| Cloud Functions | quelques centaines d'appels par mois | 0 $ (palier gratuit) |
| Cloud Scheduler | 2 tâches (rappel quotidien, résumé mensuel) | gratuit jusqu'à 3 tâches **par compte de facturation** : avec celle de Budget Maison sur le même compte, on y est tout juste ; au-delà, environ 0,10 $ par tâche et par mois |
| Secret Manager | 1 secret | quelques centimes au plus |
| Artifact Registry | les images des fonctions | quelques centimes ; le déploiement règle un nettoyage automatique des vieilles images |
| Resend | quelques dizaines de courriels par mois | 0 $ dans le forfait gratuit, partagé avec les autres applications du domaine |
| NAS, Cloudflare, GitHub | déjà en place | 0 $ de plus |

L'alerte de budget de l'étape 1.1 prévient si quelque chose déraille.

---

## Annexe — les valeurs à garder

| Valeur | Où la trouver | Où elle va |
|---|---|---|
| Identifiant du projet | étape 1 | variable `FIREBASE_PROJECT_ID` ; adresse de 5.3 |
| `apiKey`, `messagingSenderId`, `appId` | étape 4.1 | variables `VITE_FIREBASE_…` |
| Clé Web Push (VAPID) | étape 4.2 | variable `VITE_FIREBASE_VAPID_KEY` |
| Clé Resend `copropriete-smtp` | étape 6.1 | Firebase → Paramètres SMTP (6.3) — **nulle part ailleurs** |
| Clé Resend `copropriete-fonctions` | étape 6.1 | Secret Manager `RESEND_API_KEY` (6.6) — **nulle part ailleurs** |
| Clé JSON `deploiement-github` | étape 7.2 | secret GitHub `FIREBASE_SERVICE_ACCOUNT`, puis **effacée** |

Les trois clés de la fin sont de vrais secrets : gestionnaire de mots de
passe, jamais de copie dans un courriel, une note ou le dépôt.
