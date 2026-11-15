# Image du site : le bundle compilé, servi par Caddy sur le NAS.
#
# Ce fichier n'est pas à la racine et ne s'appelle pas « Dockerfile », à
# dessein : plusieurs plateformes changent de constructeur à la seule présence
# d'un Dockerfile à la racine (leçon de Groupe Loto, deux jours d'API hors
# service). Le workflow le désigne explicitement (web-image.yml).

# ─── Étape 1 : compilation ──────────────────────────────────────────────────
# Debian plutôt qu'Alpine : une incompatibilité musl ne se verrait qu'au build.
FROM node:20-slim AS build
WORKDIR /app

# Le verrou est versionné dans ce dépôt : npm ci installe exactement ce qui a
# été essayé, rien de plus récent tombé entre-temps.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# La configuration Firebase arrive du workflow (variables GitHub), jamais du
# code : changer de projet ou de domaine ne demande pas de toucher au dépôt.
# Ces valeurs ne sont pas secrètes — elles finissent dans le bundle que tout
# navigateur télécharge ; ce sont les règles Firestore qui protègent.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY

# Une image sans configuration afficherait « Configuration manquante » à tout
# le monde : mieux vaut qu'elle ne se construise pas.
RUN test -n "$VITE_FIREBASE_API_KEY" && test -n "$VITE_FIREBASE_PROJECT_ID" && test -n "$VITE_FIREBASE_APP_ID" \
    || (echo "Configuration Firebase absente : voir deploy/README.md, étape 4." && exit 1)

# vite.config.js écrit dist/version.json et estampille le service worker :
# c'est ce qui fait paraître « nouvelle version disponible » sur les appareils.
RUN npm run build

# ─── Étape 2 : service des fichiers ─────────────────────────────────────────
FROM caddy:2-alpine

# Le Caddyfile relaie la connexion Google vers <projet>.firebaseapp.com : il
# lui faut l'identifiant du projet, le même que celui compilé dans le bundle.
ARG VITE_FIREBASE_PROJECT_ID
ENV PROJET_FIREBASE=${VITE_FIREBASE_PROJECT_ID}

COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
