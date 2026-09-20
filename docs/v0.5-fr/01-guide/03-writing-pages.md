---
title: Écrire des pages
description: Frontmatter, adresses, ordre du menu, liens et images.
tags: [guide, contenu]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Écrire des pages

Une page est un fichier `.md` ou `.mdx` du dossier de version. Les deux passent
par la même chaîne : l'extension ne change pas ce qui est possible, elle dit
l'intention.

## Le frontmatter

```yaml
---
title: Installation
description: Ce qu'il faut, et comment mettre un projet en place.
date: 2026-09-09
tags: [guide, installation]
---
```

`title` devient la balise `<title>`, l'entrée de menu et le fil d'Ariane.
`description` alimente les métadonnées et le JSON-LD. `tags` s'affichent en bas
de page, sous le texte qu'ils décrivent — une étiquette seule peut s'écrire
sans crochets. Tout est facultatif : sans `title`, le nom du projet prend le
relais.

Les champs sont détaillés dans la [référence](../../reference/frontmatter/).

## Qui a écrit la page

Une page qui nomme ses auteurs, ou qui porte une date, s'ouvre sur une
signature :

```yaml
---
title: Installation
authors: [ada, grace]
date: 2026-09-09
modified: 2026-09-16
---
```

Les noms s'affichent tels quels. Pour leur donner une biographie, un portrait
et un lien, décrivez-les dans un fichier JSON du dossier de version :

```json
{
  "ada": {
    "name": "Ada Lovelace",
    "bio": "A écrit le premier algorithme destiné à une machine.",
    "avatar": "authors/ada.png",
    "url": "https://example.com/ada"
  }
}
```

Nommez ensuite ce fichier dans la configuration : `authors: 'authors.json'`. Il
est lu **dans chaque dossier de version**, comme le menu — une biographie
corrigée dans la version en cours laisse la version publiée tranquille. Le
fichier lui-même n'est pas publié ; les portraits le sont, et sont mesurés à la
génération pour que le texte ne saute pas à leur arrivée. Une version sans le
fichier montre les noms seuls : une version plus ancienne n'a pas à en recevoir
de copie.

Une clé que personne ne décrit s'affiche telle quelle, ce qui permet de nommer
ses auteurs avant de les décrire. La description alimente aussi les données de
la page : une biographie devient la `description` de sa `Person`, un lien son
`url`.

Une date écrite le jour même de la page n'est pas répétée comme mise à jour, et
une page d'accueil ne porte pas de signature du tout : c'est un hall d'entrée,
pas un document.

## Ce dont dépend l'adresse

Le chemin du fichier donne le chemin de l'adresse, débarrassé de son extension
et de son préfixe d'ordre :

| Fichier                     | Adresse                |
| --------------------------- | ---------------------- |
| `index.md`                  | `/`                    |
| `guide/01-installation.md`  | `/guide/installation/` |
| `guide/index.md`            | `/guide/`              |
| `components/02-columns.mdx` | `/components/columns/` |

Le préfixe `01-` **ordonne le menu sans apparaître dans l'adresse**. C'est la
seule façon de trier les pages autrement qu'alphabétiquement, et elle évite de
tenir une liste à part.

## L'ordre du menu

Le menu découle de l'arborescence. Les dossiers deviennent des sections, les
préfixes numériques donnent l'ordre, et un `index.md` dans un dossier fournit
le titre de la section.

```
docs/v1.0/
├── index.mdx           →  /
├── guide/
│   ├── index.md        →  /guide/        (titre de la section)
│   ├── 01-installation.md
│   └── 02-first-site.md
└── components/
    ├── index.md
    └── 01-card.mdx
```

## Séries de pages

Un dossier est une **série** : sa page `index` la présente, et les pages
voisines de cet index en sont les épisodes. Écrite dans cet index, une ligne
construit la grille de ses pages, en cartes cliquables :

```mdx
<Cards />
```

Chaque carte reprend le `title` et la `description` de sa page, son `preview`
comme image, et sa date `modified`. Sur l'index d'un dossier qui en contient
d'autres, les cartes de ces séries comptent aussi leurs pages. Rien n'est listé
à la main, donc rien ne périme quand une page est ajoutée ou renommée.

La page [Cards](../../components/cards/) détaille toutes les options.

## Écrire le menu à la main

Quand l'arborescence ne donne pas le menu voulu, décrivez-le dans un fichier
JSON du dossier de la version, et nommez-le dans la configuration :

```js
// docpensieve.config.mjs
sidebar: 'sidebar.json',
```

```json
[
  "/",
  { "label": "Commencer ici", "items": ["guide/installation", "guide/first-site"] },
  { "auto": "components" },
  { "label": "Dépôt", "href": "https://github.com/moi/mon-projet" }
]
```

Une page se nomme par son chemin, comme dans son adresse.
`{ "auto": "components" }` garde le menu automatique d'un dossier — la section
DocPensieve reste entière ainsi. Une page que le fichier oublie est quand même
publiée, seulement hors du menu, et une version sans le fichier garde le menu
de ses dossiers. Tous les genres d'entrée sont dans la
[référence de `sidebar`](../../reference/configuration/).

## Liens internes

Deux écritures, deux sens :

- **relative** — `./voisine/`, `../guide/` — se résout depuis le dossier du
  fichier de la page, comme entre deux fichiers quelconques ;
- **absolue** — `/guide/installation/` — part de la **racine de la version**,
  pas de la racine du domaine.

La seconde règle mérite qu'on s'y arrête. Une documentation ne sait pas qu'elle
peut être servie sous `/mon-projet/versions/v1.0/` : si `/guide/installation/`
était pris au pied de la lettre, tous les liens internes casseraient dès qu'un
préfixe entre en jeu. Ils sont donc réécrits à la génération.

Pour viser une vraie adresse de domaine, l'adresse complète reste possible.

## Images

Une image se pose à côté de la page et s'écrit relativement :

```md
![Schéma de la chaîne](./schema.png)
```

Les fichiers qui ne sont pas des pages sont copiés tels quels dans la sortie, à
la même place relative. Le chemin est réécrit comme un lien.

La génération lit la largeur et la hauteur de chaque image dans son fichier —
PNG, JPEG, GIF, WebP ou SVG — et les écrit dans la page : le navigateur garde
la place avant l'arrivée de l'image, au lieu de décaler le texte à ce
moment-là. Toutes les images sauf la première se chargent en différé, quand le
lecteur en approche ; la première, souvent visible d'emblée, garde son
chargement normal.

## Composants

Dans une page `.mdx`, les composants livrés s'emploient **sans import** :

```mdx
<Columns>
  <Column span={8}>L'essentiel du propos</Column>
  <Column span={4}>Une remarque de côté</Column>
</Columns>
```

Ils sont rendus à la génération : le HTML livré ne contient que leur résultat.
La liste est dans [Composants](../../components/).

`globalComponents: false` les retire de toutes les pages. C'est fait pour un
projet qui préfère apporter les siens : une page qui en emploie encore un
arrête alors la génération, en le nommant.

## Un piège à connaître

Le contenu d'une balise JSX **laissé seul sur sa ligne** devient un
paragraphe :

```mdx
<p className="flex gap-3">Du texte</p>
```

produit `<p class="flex gap-3"><p>Du texte</p></p>` — deux paragraphes
imbriqués, ce qui est invalide. Le navigateur ferme le premier de lui-même :
l'enveloppe disparaît, et la mise en page voulue avec elle.

Le formateur rend le piège sournois. Une longue chaîne de classes finit coupée
sur plusieurs lignes, ce qui laisse le texte seul sur sa ligne **après coup**,
sans que personne l'ait écrit ainsi.

Trois façons de s'en prémunir :

- préférer `<div>` à `<p>` comme enveloppe — un paragraphe y est valide ;
- écrire un contenu court sur la même ligne que ses balises ;
- pour les cas répétés, poser une classe dans le dossier `theme/` plutôt
  qu'une longue chaîne d'utilitaires, afin que la ligne reste courte.

`docpensieve check` signale ces imbrications sur le site produit.

## Ce qui n'est pas publié

Une page dont le frontmatter porte `draft: true` est chargée mais gardée hors
de la sortie. C'est ce qui permet à une page en cours de rester dans le dépôt
sans être publiée.
