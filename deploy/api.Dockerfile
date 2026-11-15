# Image de l'API des pièces jointes (deploy/api/serveur.mjs).
#
# Pas à la racine et pas nommé « Dockerfile », comme web.Dockerfile : voir
# son en-tête. Désigné explicitement par .github/workflows/api-image.yml.
#
# Aucune dépendance npm à installer : l'image ne contient que Node, le
# serveur et package.json (pour le numéro de version de /api/health).
FROM node:20-alpine

WORKDIR /app
COPY deploy/api/serveur.mjs ./serveur.mjs
COPY package.json ./package.json

# Le projet Firebase dont on vérifie les jetons. Compilé dans l'image depuis
# la variable du dépôt, comme pour le site : aucun fichier à remplir sur le NAS.
ARG PROJET_FIREBASE
ENV PROJET_FIREBASE=${PROJET_FIREBASE}
RUN test -n "$PROJET_FIREBASE" || (echo "PROJET_FIREBASE absent : variable FIREBASE_PROJECT_ID du dépôt." && exit 1)

ENV DOSSIER=/data PORT=8080 NODE_ENV=production
EXPOSE 8080

# root et non « node », à dessein : le dossier des fichiers est créé par
# File Station, au nom d'un utilisateur de DSM, et un utilisateur 1000 du
# conteneur n'aurait pas le droit d'y écrire — l'envoi échouerait en silence.
# Le conteneur n'expose rien d'autre que ce serveur, sur le réseau edge.
CMD ["node", "serveur.mjs"]
