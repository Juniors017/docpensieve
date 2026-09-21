---
title: Configuration
description: Tous les champs de docpensieve.config.mjs, leur valeur par défaut et leur effet.
tags: [référence, configuration]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Configuration

Le fichier `docpensieve.config.mjs`, à la racine du projet.

C'est un module ES — d'où le `.mjs`, que Node lit comme tel quoi que dise le
`package.json` du projet. `docpensieve.config.js` fonctionne aussi, dans un
projet dont le `package.json` déclare `"type": "module"` ; les deux fichiers
présents, la génération s'arrête plutôt que d'en choisir un.

```js
/** @type {import('@docpensieve/core').DocPensieveConfig} */
export default {
  projectName: 'Ma documentation',
  siteUrl: 'https://example.com/mon-projet',

  versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],

  outDir: 'dist',

  theme: {
    framework: 'tailwind',
    darkMode: 'class',
  },

  sidebar: 'auto',
  globalComponents: true,
  jsonld: { enabled: true },
};
```

Le commentaire `@type` donne l'autocomplétion et la vérification de types dans
l'éditeur sans rien importer : le fichier reste lisible même là où DocPensieve
ne tourne que par `npx`. Dans un projet qui l'installe en dépendance,
`defineConfig` de `@docpensieve/core` fait la même chose.

`docpensieve init` écrit ce fichier avec **tous les champs** — à leur valeur
par défaut, ou en commentaire avec un exemple — pour qu'il vous dise aussi ce
que vous pouvez changer.

## Les champs

| Champ              | Défaut              | Effet                                                                                              |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------------------- |
| `projectName`      | `'Documentation'`   | Nom affiché dans l'en-tête et dans le JSON-LD                                                      |
| `siteUrl`          | `''`                | Adresse publique. Sert au `canonical` et au JSON-LD                                                |
| `baseUrl`          | `'/'`               | Préfixe de déploiement. Découle de `siteUrl` quand il est omis                                     |
| `outDir`           | `'dist'`            | Dossier de sortie, relatif à la racine                                                             |
| `versions`         | `[]`                | Au moins une entrée                                                                                |
| `theme`            | voir plus bas       | Habillage                                                                                          |
| `sidebar`          | `'auto'`            | `'auto'` : le menu suit l'arborescence. Ou un fichier `.json` de chaque dossier de version         |
| `authors`          | `''`                | Un fichier `.json` décrivant les auteurs, dans chaque dossier de version qui en a un               |
| `headerLinks`      | `[]`                | Liens de l'en-tête, à côté du sélecteur de version                                                 |
| `foldedSidebar`    | `false`             | Les catégories du menu se replient, ouvertes là où se trouve le lecteur                            |
| `admonitions`      | `{}`                | Types d'admonition que le projet ajoute aux six livrés : un libellé, un ton, une icône facultative |
| `stickyHeader`     | `true`              | L'en-tête reste en haut de l'écran ; `false` le laisse défiler                                     |
| `globalComponents` | `true`              | Composants livrés, disponibles sans import                                                         |
| `scrollToTop`      | `true`              | Bouton de retour en haut sur chaque page                                                           |
| `copyCode`         | `false`             | Un bouton copiant chaque bloc de code — le seul champ qui fasse charger un script à une page       |
| `snippetIcons`     | `''`                | Jeu d'icônes où un bloc de code prend la marque de son langage, `'simple-icons'`                   |
| `jsonld`           | `{ enabled: true }` | Données structurées                                                                                |
| `lang`             | `'en'`              | Langue du site : `<html lang>`, et les mots de la coquille                                         |
| `ui`               | `{}`                | Mots de la coquille, par langue — corrige un mot, ou ajoute une langue                             |
| `logo`             | `''`                | Image à côté du nom du projet, dans l'en-tête                                                      |
| `favicon`          | `''`                | Icône de l'onglet : `.ico`, `.png` ou `.svg`                                                       |
| `socialImage`      | `''`                | Aperçu d'une page partagée. A besoin de `siteUrl`                                                  |
| `sitemap`          | `true`              | `sitemap.xml` des versions publiées, dès que `siteUrl` est posé                                    |
| `feed`             | `false`             | Flux RSS des pages datées. A besoin de `siteUrl`                                                   |
| `search`           | `true`              | Champ de recherche dans l'en-tête, et une page de recherche générée avec le site                   |

## Les images

```js
logo: 'branding/logo.png',
favicon: 'branding/favicon.png',
socialImage: 'branding/social.png',
```

Les chemins partent de la racine du projet. Chaque image est copiée dans chaque
version, sous `assets/`, pour qu'une version reste entière sur sa branche.

- `logo` se place à côté du nom du projet, à la hauteur du texte de l'en-tête :
  une image carrée s'y lit le mieux. Son `alt` reste vide, puisque le nom la
  suit. C'est aussi le logo de l'organisation dans les données structurées.
- `favicon` est l'icône de l'onglet : `.ico`, `.png` ou `.svg`.
- `socialImage` est ce qu'un réseau social montre d'une page partagée, avec son
  titre et sa description. 1200 × 630 pixels est la taille d'usage, et le SVG
  n'y est pas lu. Ces réseaux ne lisent qu'une adresse absolue, d'où `siteUrl`.

Une image déclarée qui n'existe pas arrête la génération, en nommant le champ.

## Plan du site et flux

```js
siteUrl: 'https://example.com',
sitemap: true, // le défaut
feed: true,
```

Dès que `siteUrl` est posé, la génération écrit `sitemap.xml` à la racine du
site : toutes les pages de toutes les versions, sauf une version en
préparation, dont les pages portent `noindex`. Chaque page est datée par son
`modified`, ou à défaut son `date`. `sitemap: false` le désactive.

`robots.txt` l'accompagne quand le site est servi à la racine de son domaine.
Les moteurs ne lisent ce fichier que là : sous un sous-chemin, il serait écrit
pour personne — déclarez-leur le plan du site directement.

`feed: true` écrit `feed.xml`, un flux RSS des pages de la version courante qui
portent une `date`, la plus récente d'abord, et chaque page l'annonce dans son
en-tête. Il est désactivé par défaut : la plupart des pages de documentation ne
portent pas de date.

Les deux listent des adresses absolues : demandés sans `siteUrl`, ils arrêtent
la génération.

## La recherche

`search: true`, le défaut, pose un champ de recherche dans l'en-tête et génère
une page de recherche dans chaque version, sous `/search/`. La génération écrit
l'index de la version — le texte brut de chaque page — et la page de recherche
liste déjà toutes les pages avec leur description.

Le champ est un simple formulaire qui mène à cette page : il ne demande aucun
script. La page de recherche en charge un, de quelques kilo-octets, qui filtre
la liste à mesure que vous tapez, les meilleures correspondances d'abord, avec
un extrait de chacune. Sans JavaScript, la page reste la liste complète.

La page de recherche est tenue hors des moteurs (`noindex`) et hors du plan du
site. Une page à vous sous `/search/` prendrait sa place : la génération la
refuse, et `search: false` libère l'adresse.

## `copyCode`

`copyCode: true` pose sur chaque bloc de code un bouton qui le copie.

Il est éteint par défaut, parce que c'est le seul champ qui fasse charger un
script à une page ordinaire. Activé, le comportement est écrit **une fois par
version**, dans `assets/client.js` à côté de la feuille de style, et partagé
par toutes les pages et toutes les langues — un lecteur qui l'a en cache ne le
paie qu'une fois. Seules les pages qui contiennent un bloc de code le
chargent ; les autres continuent de ne rien charger.

Deux kilooctets environ, compressés. Aucun framework, aucune hydratation : le
code est du DOM nu, et le bouton est dessiné par le script lui-même. Sans
JavaScript, le bloc est exactement ce qu'il était, du texte qu'on sélectionne
— il n'y manque que le bouton.

L'étiquette suit la langue de la page, en anglais comme en français.

## `versions`

```js
versions: [
  { slug: 'v2.0', name: '2.0', folder: 'docs/v2.0', current: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', archived: true },
],
```

| Champ          | Rôle                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`         | Identifiant d'adresse et de branche. Un numéro (`v1.0`) fige l'adresse ; un canal (`latest`, `beta`) la garde juste au fil des sorties |
| `name`         | Libellé affiché dans le sélecteur                                                                                                      |
| `folder`       | Dossier des sources, relatif à la racine                                                                                               |
| `current`      | Version servie par défaut. Au plus une                                                                                                 |
| `archived`     | Version conservée mais plus maintenue. Bandeau, mais reste indexée                                                                     |
| `prerelease`   | Version en préparation. Bandeau **et** `noindex`                                                                                       |
| `logo`         | Le logo de cette version, à la place de celui du projet — une bêta reconnue d'un coup d'œil                                            |
| `favicon`      | La favicone de cette version, à la place de celle du projet                                                                            |
| `translations` | Dossier de chaque traduction, par code de langue : `{ fr: 'docs/v1.0-fr' }`                                                            |

## `theme`

```js
theme: {
  framework: 'tailwind',
  darkMode: 'class',
  tokens: { '--dp-accent': 'oklch(55% 0.2 250)' },
  css: '.dp-article h2 { letter-spacing: -0.01em; }',
  source: '@import "tailwindcss";',
},
```

| Champ       | Effet                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `framework` | `'tailwind'` ou `'custom'`                                                                                                                 |
| `darkMode`  | `'class'` suit le système du lecteur ; `'dark'` ou `'light'` impose un schéma                                                              |
| `toggle`    | Actif par défaut : un bouton clair / sombre dans l'en-tête, retenu de page en page — quelques lignes de script en ligne. `false` le retire |
| `tokens`    | Jetons `--dp-*` redéfinis                                                                                                                  |
| `css`       | CSS ajouté à la feuille produite                                                                                                           |
| `source`    | Feuille remise au compilateur utilitaire                                                                                                   |

Les jetons disponibles sont listés dans [Thèmes](../guide/themes/).

Les règles plus longues vont dans le dossier `theme/`, à la racine du projet :
chaque fichier `.css` qui s'y trouve est ajouté après `css`, dans l'ordre des
noms, et `docpensieve dev` suit chaque changement. Sous le thème `custom`,
`init` l'amorce avec `theme/custom.css`.

## `authors`

```js
authors: 'authors.json',
```

Nomme un fichier JSON **lu dans chaque dossier de version**, décrivant les
auteurs qu'une page nomme dans son frontmatter : un nom, une biographie, un
portrait, un lien.

Vide par défaut, et une page montre alors les noms qu'elle donne, sans le
reste : le fichier enrichit, il ne commande pas. Une version sans le fichier
montre les noms seuls, si bien que décrire les auteurs d'une nouvelle version
n'oblige pas à copier le fichier dans les plus anciennes. Un fichier présent
mais illisible, ou mal écrit, arrête la génération.

Le fichier n'est pas publié. Les portraits le sont, leur chemin partant du
dossier de version pour qu'ils voyagent avec lui.

## `headerLinks`

```js
headerLinks: [
  { label: 'Blog', href: '/blog/' },
  { label: 'Exemples', href: '/examples/', version: 'beta' },
  { label: 'Dépôt', href: 'https://github.com/moi/mon-projet' },
],
```

Liens de l'en-tête, à côté du sélecteur de version. Une cible part de la racine
de la version — `/blog/` — ou est une adresse complète. Une cible relative est
refusée : l'en-tête est sur toutes les pages, et `blog/` voudrait dire autre
chose sur chacune.

`version` nomme la version vers laquelle mène un lien. Sans lui, chaque version
renvoie vers sa propre page ; avec lui, toutes mènent à celle-là — ce qui garde
atteignable depuis toutes une section écrite dans une seule. Une version que
personne n'a déclarée arrête la génération.

Sur un écran étroit, le sélecteur de version, les liens et le champ de
recherche passent derrière un bouton de menu. C'est un élément natif, qui
s'ouvre sans script, comme le sélecteur de version lui-même.

### Un panneau de liens

Une entrée portant `columns` ouvre un panneau au lieu de mener quelque part :

```js
headerLinks: [
  {
    label: 'Produit',
    columns: [
      {
        title: 'Guide',
        items: [
          { label: 'Installer', href: '/guide/installation/' },
          { label: 'Déployer', href: '/guide/deployment/' },
        ],
      },
      { items: [{ label: 'Dépôt', href: 'https://github.com/moi/mon-projet' }] },
    ],
  },
],
```

Une colonne peut se passer de titre. Chaque lien suit les règles ci-dessus —
cible absolue, `version` facultative. Une entrée ne peut pas porter à la fois
`href` et `columns` : elle mène quelque part ou ouvre un panneau, jamais les
deux.

Le panneau se déclare ici, il ne découle pas du menu de la documentation : les
deux peuvent coexister avec des liens différents, ou le site peut se passer de
barre latérale et naviguer depuis le seul en-tête.

## `stickyHeader`

```js
stickyHeader: false,
```

L'en-tête se tient en haut de l'écran par défaut : le champ de recherche, le
sélecteur de version et le menu restent à portée où que soit le lecteur dans la
page.

`false` le laisse défiler avec la page, ce qui rend sa hauteur au texte — sur
un téléphone tenu d'une main, cette hauteur représente un tiers du visible. Les
ancres cessent alors de lui réserver de la place : un lien vers un titre ne
laisse plus de bande blanche au-dessus.

## `foldedSidebar`

```js
foldedSidebar: true,
```

Chaque catégorie du menu devient un repli. La branche qui contient la page lue
est ouverte, les autres fermées : un menu de cent pages cesse de demander au
lecteur de faire défiler ce qui ne le concerne pas. Il se replie sans script.

Une catégorie qui est aussi une page reçoit cette page en première entrée : la
poignée d'un repli ne peut pas être un lien en plus sans qu'un clic veuille
dire deux choses.

Laissé à `false`, le menu s'affiche entier, comme avant. Sur un écran étroit,
le menu entier se replie au-dessus du contenu de toute façon, la colonne
n'ayant nulle part où tenir.

## `sidebar`

`'auto'` construit le menu depuis l'arborescence : les dossiers deviennent des
catégories, et les préfixes `01-`, `02-` donnent l'ordre. Pour l'écrire à la
main, nommez un fichier JSON :

```js
sidebar: 'sidebar.json',
```

Il est lu dans **le dossier de chaque version** — `docs/v1.0/sidebar.json` —
puisque chaque version a ses propres pages. Une version sans le fichier garde
le menu de ses dossiers, si bien qu'un menu écrit pour une nouvelle version
n'oblige à aucune copie dans les anciennes. Le fichier contient un tableau
d'entrées, gardées dans l'ordre écrit :

```json
[
  "/",
  { "label": "Guide", "page": "guide", "items": ["guide/installation", "guide/first-site"] },
  { "page": "reference/cli", "label": "Commandes" },
  { "auto": "docpensieve" },
  { "label": "Dépôt", "href": "https://github.com/moi/mon-projet" }
]
```

| Entrée                          | Ce qu'elle donne                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `"guide/installation"`          | Une page, par son chemin dans la version, comme dans son adresse — `"/"` pour l'accueil |
| `{ "page", "label" }`           | La même page, avec un libellé à elle                                                    |
| `{ "label", "items", "page"? }` | Une catégorie, cliquable quand elle nomme une page                                      |
| `{ "label", "href" }`           | Un lien hors du site                                                                    |
| `{ "auto": "dossier" }`         | Le menu automatique d'un dossier : la section DocPensieve garde ainsi le sien           |

Une page laissée de côté reste publiée : elle est seulement absente du menu. Un
chemin qui ne nomme aucune page, une page listée deux fois, ou une entrée d'un
genre inconnu arrêtent la génération, en nommant le fichier et les chemins
proches de celui écrit. Le fichier lui-même n'est pas publié.

## `baseUrl`, et pourquoi on l'écrit rarement

Un `siteUrl` avec un sous-chemin le donne déjà :
`https://example.com/mon-projet` produit `baseUrl: '/mon-projet/'`. L'écrire ne
sert qu'à s'en écarter.

Le préfixe est normalisé avec ses deux barres obliques. C'est lui qui préfixe
chaque lien interne : s'il est faux, tous les liens le sont.

## Ce qui est refusé

| Cas                                 | Message                           |
| ----------------------------------- | --------------------------------- |
| La configuration n'est pas un objet | Un exemple de l'export attendu    |
| Aucune version déclarée             | Un exemple d'entrée complète      |
| Deux versions avec le même slug     | Le slug fautif                    |
| Plusieurs versions `current`        | La liste de celles trouvées       |
| `framework` inconnu                 | Les valeurs acceptées             |
| Slug demandé introuvable            | Les slugs disponibles             |
| Une image du mauvais genre          | Les extensions acceptées          |
| `socialImage` sans `siteUrl`        | Pourquoi l'adresse est nécessaire |
| Une image déclarée mais absente     | Le champ et son chemin            |

Chacun arrête la génération avec un message et une piste, sans pile d'appels.

## Ce qui se complète tout seul

Si **aucune** version ne porte `current`, la première de la liste devient
courante. Une configuration à une seule version n'a donc rien à préciser — ce
champ ne commence à compter qu'à partir de la deuxième.
