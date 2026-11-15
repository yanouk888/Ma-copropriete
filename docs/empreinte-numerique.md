# Empreinte numérique

**Ce document est portable.** Il ne parle pas de Mon horaire + en particulier :
il énonce les règles qui valent pour tout ce que Yannick fait construire. À
recopier tel quel dans chaque nouveau projet.

> **La consigne, en une phrase :** rien de ce qu'on construit ne cherche à être
> trouvé. Pas de référencement, pas d'analytique, pas de données réelles dans
> ce qui est publié, et le moins de nom possible là où on ne peut pas
> l'éviter.

## 1. Ne jamais paraître dans un moteur

Il y a un piège, et presque tout le monde tombe dedans.

**Ce qui ne marche pas :** `Disallow: /` dans `robots.txt`. Interdire
l'exploration empêche le robot de **lire** la page, donc de voir qu'elle porte
`noindex`. Si un lien pointe un jour vers l'adresse, elle peut paraître quand
même dans les résultats — nue, sans description, et sans moyen de la faire
retirer.

**Ce qui marche :** laisser explorer, et répondre `noindex`. Le robot vient,
lit la consigne, repart sans rien garder.

Donc, dans cet ordre d'importance :

1. **L'en-tête `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` sur
   chaque réponse.** C'est lui qui fait le travail — il couvre aussi les
   fichiers qui ne sont pas des pages et ne peuvent pas porter de `<meta>` :
   PDF, images, `.ics`, JSON.
2. La balise `<meta name="robots" content="noindex, …">` dans chaque page, en
   redondance.
3. Un `robots.txt` qui **autorise** l'exploration, avec un commentaire qui
   explique pourquoi — sinon quelqu'un « corrigera » ça un jour.

Sur Cloudflare Pages, l'en-tête se pose dans un fichier `_headers`.

## 2. Ce qui fuit malgré tout

Le non-référencement ne rend rien invisible. Trois canaux restent ouverts, et
il faut les connaître.

**Les journaux de transparence des certificats.** Chaque certificat TLS émis
est inscrit dans un registre **public et permanent**. Un certificat pour
`horaire.exemple.app` rend ce sous-domaine trouvable par n'importe qui, en une
requête, dès la première seconde. C'est la fuite la plus sous-estimée.

*La parade :* un certificat **générique** (`*.exemple.app`) ne révèle pas les
sous-domaines. Cloudflare en émet un par défaut — il ne faut simplement pas
demander de certificat nominatif par sous-domaine.

**Le DNS.** Les noms de sous-domaines se devinent. On ne compte pas sur leur
obscurité pour protéger quoi que ce soit : ce qui doit être privé est derrière
une authentification, pas derrière un nom peu probable.

**Le registraire.** Le masquage du WHOIS est public, pas juridique : en cas de
litige, la donnée réelle est communiquée. Elle doit donc être exacte — et le
vrai nom y est un atout, pas un risque.

## 3. Ne pas semer son nom

- **Dépôts privés par défaut.** Un dépôt public est indexé, et il porte le nom,
  les adresses de courriel et l'historique complet.
- **Pas de courriel personnel dans les commits.** Le courriel de commit finit
  dans l'historique pour toujours, et il est public dès que le dépôt l'est.
  Utiliser une adresse `noreply` ou un alias dédié.
- **Aucune donnée réelle dans les maquettes ni les jeux d'essai.** Des noms
  inventés, des adresses en `@exemple.ca`, des jetons factices. Une capture
  d'écran se partage plus vite qu'on ne le croit.
- **`Referrer-Policy: no-referrer`**, pour qu'un clic sortant ne raconte pas
  d'où il vient.
- **Aucune analytique tierce**, aucune police hébergée ailleurs, aucun script
  de CDN qui n'est pas indispensable. Chacun est un tiers qui voit passer les
  visiteurs.

## 4. Le nom de domaine n'est jamais écrit en dur

Une seule variable d'environnement le porte. Tout ce qui se colle chez
l'utilisateur — une adresse d'abonnement à un calendrier, un lien dans un
courriel — devient autrement impossible à déplacer sans rien casser.

Ça protège d'un changement d'idée comme d'un litige.

## 5. Ce que ça coûte, honnêtement

Un site qu'aucun moteur ne connaît laisse **moins de traces datées** de son
existence. Or, pour un domaine qui porte un patronyme aussi porté par une
marque, la preuve d'un usage réel et ancien a de la valeur (voir
[`nom-de-domaine.md`](nom-de-domaine.md)).

La compensation se fait ailleurs, et elle suffit : l'historique du dépôt est
horodaté par un tiers, les factures du registraire et de l'hébergeur le sont
aussi. Ce sont de meilleures preuves qu'un cache de moteur de recherche.

## Sources

- [Google Search Central — introduction au robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Quand utiliser `noindex` plutôt que `Disallow`](https://www.searchenginejournal.com/google-on-robots-txt-when-to-use-noindex-vs-disallow/534427/)
