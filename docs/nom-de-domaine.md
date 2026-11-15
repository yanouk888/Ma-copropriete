# Le nom de domaine

**`ricard.app`, enregistré chez Cloudflare Registrar par Yannick Ricard.**
Document rédigé le 14 septembre 2026, au moment où le domaine a été pris.

Ceci n'est pas un avis juridique. C'est la trace datée d'une décision et de
ses raisons — ce qui, en soi, a une valeur : la date d'un commit est posée par
GitHub, pas par nous.

## La situation

« Ricard » est **le nom de famille du titulaire**. C'est aussi une marque
déposée notoire (Pernod Ricard, spiritueux). Le domaine sert à un usage
**personnel et non commercial** : héberger des outils écrits pour soi et pour
un petit groupe fermé, dans un domaine d'activité sans aucun rapport avec les
boissons alcoolisées.

## Ce qui protège

**Le nom propre.** La *Loi sur les marques de commerce* (L.R.C. 1985, ch. T-13)
prévoit à son article 20(1.1) que l'enregistrement d'une marque n'empêche pas
« tout usage de bonne foi de son nom personnel ». En amont, la contrefaçon
suppose un usage **en liaison avec des produits ou services** de nature à créer
de la confusion : une application d'horaire n'en crée aucune avec un apéritif.

**La procédure UDRP**, qui est le recours réaliste pour un titulaire de marque
(rapide, peu coûteux pour lui), reconnaît explicitement comme intérêt légitime
le fait d'être « communément connu sous ce nom » (paragraphe 4(c)(ii)). Un
patronyme suffit généralement, sur preuve d'identité.

Pour gagner, un plaignant doit établir **les trois** éléments : domaine
identique à sa marque, absence de droit ou d'intérêt légitime du titulaire,
**et** enregistrement **et** usage de mauvaise foi. Le premier est acquis. Les
deux autres ne le sont pas, et ne le deviendront pas tant que les règles
ci-dessous sont tenues.

## Ce qui fragiliserait

La doctrine de la **détention passive** (*Telstra c. Nuclear Marshmallows*,
OMPI D2000-0003) veut qu'un domaine identique à une marque connue et qui ne
sert à rien puisse être jugé utilisé de mauvaise foi **précisément parce qu'il
ne sert à rien**. Une page blanche ou un « bientôt disponible » n'y change
rien.

Quatre facteurs sont pesés. Voici où nous nous situons, honnêtement :

| Facteur | Nous |
|---|---|
| Notoriété de la marque | **Contre nous**, et c'est hors de notre contrôle |
| Aucune preuve d'un usage de bonne foi | Réglé : la page de `racine/` |
| Identité dissimulée, fausses coordonnées | Réglé : titulaire au vrai nom |
| Implausibilité d'un usage de bonne foi | Réglé : c'est le patronyme |

Un facteur sur quatre nous est défavorable, et c'est le seul qu'on ne peut pas
changer.

## Les règles à tenir

1. **Aucune monétisation.** Ni publicité, ni abonnement, ni don. C'est ce qui
   tient tout le reste.
2. **Aucune variante.** Pas de `ricard.com`, `.ca`, `.fr`. Un domaine, c'est un
   homme qui porte un nom ; plusieurs, c'est un motif — et le motif est un
   indice de mauvaise foi.
3. **Rien de la marque.** Ni le jaune et bleu, ni le logo, ni l'imagerie de
   l'apéritif, pas même en clin d'œil.
4. **Le produit ne porte pas le nom.** L'application s'appelle **Mon horaire +**.
   Le domaine n'est qu'une adresse. C'est délibéré, et ça doit le rester.
5. **La racine reste une page personnelle**, l'application vit sur un
   sous-domaine. Le domaine se lit alors comme ce qu'il est : celui d'une
   famille.
6. **Le domaine n'est jamais écrit en dur.** Voir plus bas.
7. **Coordonnées de titulaire exactes** chez le registraire. Le masquage public
   de Cloudflare est sans effet ici : en cas de litige, c'est la donnée réelle
   qui est communiquée, et le vrai nom y est la meilleure pièce.
8. **Si une mise en demeure arrive : ne pas répondre seul, et ne jamais
   nommer de prix.** Cette seule phrase transformerait une possession
   défendable en preuve de mauvaise foi. Une consultation ponctuelle chez un
   avocat en propriété intellectuelle coûte quelques centaines de dollars.

## Le domaine hors du code

C'est une règle d'ingénierie autant que de prudence.

Les adresses d'abonnement au calendrier (`…/calendrier/<jeton>.ics`) sont
collées par l'utilisateur dans Google Agenda ou dans son iPhone. **Si le
domaine changeait, tous les calendriers abonnés casseraient en silence** — les
siens et ceux de ses proches.

Donc : une seule variable d'environnement porte le domaine, et l'ancienne
adresse doit pouvoir rediriger vers la nouvelle. Ça protège d'un litige comme
d'un simple changement d'idée.

## Ce qui reste à faire, côté Yannick

- [x] Titulaire déclaré chez Cloudflare : « Yannick Ricard ». Les quatre
      rôles — enregistrant, administrateur, technique, facturation — portent
      ce nom. C'est la pièce maîtresse du dossier : le domaine est au nom de
      celui qui le porte. *Vérifié à l'écran le 15 septembre 2026.*
- [x] Double authentification active sur le compte Cloudflare.
      *Fait le 14 septembre 2026.*
- [x] Renouvellement automatique activé, et verrou de transfert en place
      — Cloudflare le maintient d'office pendant les 60 jours qui suivent
      l'enregistrement, le bouton « Déverrouiller » est inactif.
      *Vérifié le 15 septembre 2026.*
- [x] Confidentialité WHOIS activée (rédaction des données par Cloudflare).
      Sans effet en cas de litige — la donnée réelle est alors communiquée —
      mais elle tient le nom hors des moissonneurs. *Vérifié le 15 septembre 2026.*
- [x] **DNSSEC** activé le 16 septembre 2026. Cloudflare pose
      l'enregistrement DS au registre `.app` tout seul ; la mention « en
      attente » est normale et se résorbe en moins de 24 h.
      *À retenir : si le DNS déménage un jour, désactiver DNSSEC **avant**,
      sinon le domaine devient injoignable.*
- [ ] Déployer `racine/` sur Cloudflare Pages, à la racine du domaine.
- [ ] Faire pointer l'application sur un sous-domaine.
- [ ] Classer la facture Cloudflare avec une pièce d'identité, dans un
      dossier à part.
- [ ] Consulter la base de l'OPIC pour savoir dans quelles classes RICARD est
      déposée au Canada : <https://ised-isde.canada.ca/cipo/trademark-search/srch>

## Sources

- [Loi sur les marques de commerce, art. 20 — Justice Canada](https://laws-lois.justice.gc.ca/eng/acts/t-13/section-20.html)
- [OMPI — guide de la procédure UDRP](https://www.wipo.int/en/web/amc/domain-name-disputes/guide/index)
- [*Telstra c. Nuclear Marshmallows* et la détention passive](https://giga.law/blog/2020/11/4/udrp-case-study-telstra-v-nuclear-marshmallows-passive-holding-doctrine)
