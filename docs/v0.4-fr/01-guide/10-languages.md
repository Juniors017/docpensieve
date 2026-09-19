---
title: Langues
description: Publier la même version en plusieurs langues — les dossiers, les adresses, et ce qu'il advient d'une page que personne n'a traduite.
tags: [guide, langues]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Langues

Une version peut être publiée en plusieurs langues. Chacune est un dossier de
pages à elle, posé à côté de la version qu'elle traduit.

## Déclarer une traduction

```js
lang: 'en',
versions: [
  {
    slug: 'latest',
    name: '1.0',
    folder: 'docs/v1.0',
    current: true,
    translations: { fr: 'docs/v1.0-fr' },
  },
],
```

`lang` est la langue du site — celle dans laquelle vos pages sont écrites.
Chaque entrée de `translations` nomme une langue et le dossier qui porte cette
traduction.

```
docs/
├── v1.0/          la langue du site
│   ├── index.md
│   └── guide/
└── v1.0-fr/       sa traduction française
    ├── index.md
    └── guide/
```

## Les adresses

La langue du site garde les adresses qu'elle a ; une traduction est servie sous
son code :

| Page                 | Adresse                              |
| -------------------- | ------------------------------------ |
| La langue du site    | `/versions/latest/guide/install/`    |
| Sa jumelle française | `/versions/latest/fr/guide/install/` |

Rien de publié ne bouge, et c'est bien l'intérêt : un lien partagé l'an dernier
mène toujours là où il menait. La traduction vit **à l'intérieur** de la
version, si bien qu'une version reste un dossier, une branche orpheline, une
feuille de style.

## Une page que personne n'a traduite

Elle n'existe pas dans cette langue. Elle est absente du menu de cette langue
et du plan du site, aucun `hreflang` ne la promet, et le sélecteur de langue
nomme la langue sans la proposer — un lecteur apprend que le site a une version
française, et ne reçoit jamais de l'anglais sous une adresse française.

C'est ce qui permet de commencer une traduction par cinq pages. Traduisez
d'abord ce qui compte ; le reste demeure dans la langue où il a été écrit
jusqu'à ce que quelqu'un s'en occupe.

## Les mots autour de vos pages

Le menu, les bandeaux, le champ de recherche et les dates suivent la langue de
la page. L'anglais et le français sont livrés avec l'outil.

Une langue qu'il ne livre pas garde les mots anglais, et le champ `ui` est là
où un projet écrit les siens — ou corrige un mot :

```js
lang: 'de',
ui: {
  de: { search: 'Suchen', onThisPage: 'Auf dieser Seite' },
},
```

Ce qui est omis reste en anglais plutôt que vide : une demi-traduction reste une
page lisible. Une clé qui n'existe pas arrête la génération, en listant celles
qui existent — une faute de frappe y laisserait le mot livré en place, sans un
mot.

## Ce que chaque langue a en propre

| En propre                                  | Partagé avec la version             |
| ------------------------------------------ | ----------------------------------- |
| Pages, menu, page de recherche             | La feuille de style                 |
| Fichier d'auteurs et images de son dossier | Le logo et la favicone              |
| Les mots de la coquille                    | Le bandeau de version et son numéro |

Le fichier d'auteurs est lu dans chaque dossier : une biographie peut donc être
traduite avec les pages qu'elle signe.

## Ce qu'il faut vérifier

- **Un dossier de traduction nommé mais absent** arrête la génération, en
  nommant la langue plutôt que le seul dossier.
- **`check` après l'arrivée d'une traduction** : une page ajoutée d'un côté et
  liée depuis l'autre est le premier lien mort habituel.
- Employez les mêmes chemins de page des deux côtés. Une page traduite sous un
  autre nom de fichier est une autre page : elle n'a pas de jumelle, et le
  sélecteur le dit.
