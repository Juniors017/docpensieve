---
title: Premier site
description: Générer, servir, et comprendre ce qui a été produit.
tags: [guide]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Premier site

## Générer

```bash
npx docpensieve build
```

Toutes les versions déclarées sont générées. Pour n'en générer qu'une, passez
son slug :

```bash
npx docpensieve build v1.0
```

## Regarder le résultat

```bash
npx docpensieve serve
```

Le dossier de sortie est servi statiquement sur le port 4000. C'est exactement
ce que fera un hébergeur : aucune différence entre ce serveur et la mise en
ligne.

## Travailler

```bash
npx docpensieve dev
```

Le serveur de développement surveille les sources et régénère à chaque
enregistrement. Il écoute sur le port 3000 ; `--port` en change.

La différence avec `serve` tient à ceci : `dev` régénère, `serve` ne fait que
servir. Pour vérifier ce qui sera réellement publié, enchaînez `build` puis
`serve`.

## Ce qui a été produit

```
dist/
├── index.html              redirection vers la version courante
├── versions.json           les versions et leurs adresses
└── versions/
    └── v1.0/
        ├── index.html      la page d'accueil de la version
        ├── assets/
        │   └── docpensieve.css
        └── guide/
            └── installation/
                └── index.html
```

Trois choses méritent d'être remarquées.

**Chaque page est un dossier contenant un `index.html`.** C'est ce qui donne
des adresses sans extension — `/guide/installation/` plutôt que
`/guide/installation.html` — sans rien demander à l'hébergeur.

**Une seule feuille de style pour toute la version.** Elle est compilée en
dernier, une fois les pages écrites, parce qu'un thème utilitaire a besoin de
savoir quelles classes ont réellement servi pour n'émettre que celles-là.

**Le `versions.json` à la racine** décrit les versions disponibles. C'est lui
qui permet à des versions générées il y a longtemps de rester en ligne sans
jamais être regénérées.

Le dossier lui-même est `dist/`, que `outDir` change — vers `public/`, ou vers
ce que votre hébergeur attend. La génération vide les dossiers qu'elle écrit et
laisse le reste de ce dossier tranquille : un dossier de sortie partagé avec
autre chose garde ce qui ne lui appartient pas.

## Relire ce qui sort

Une génération réussie ne dit rien d'un lien mort : rien dans la chaîne ne les
regarde. Une commande s'en charge :

```bash
npx docpensieve build
npx docpensieve check
```

Elle parcourt les pages produites, retire le préfixe de déploiement de chaque
cible interne et vérifie que le fichier existe. Elle signale aussi les cibles
qui **ignorent** ce préfixe — le fichier est là, mais le lien ne mènera nulle
part une fois en ligne.

```
  index.html
    /guide/installation/
    → ignores the deployment prefix "/mon-projet/"
```

C'est le contrôle à lancer après tout changement de `baseUrl`, de structure de
dossiers ou d'adresse. Quand quelque chose ne colle pas,
[Quand ça casse](./when-it-breaks/) recense les pannes que cet outil produit,
par le symptôme que vous voyez.

## Chercher dans le site

Chaque page porte un champ de recherche dans son en-tête. Il mène à la page de
recherche de la version, sous `/search/`, que la génération écrit avec le site :
la liste de toutes les pages, qu'un petit script filtre à mesure que le lecteur
tape — les meilleures correspondances d'abord, chacune avec un extrait. C'est
la seule page à charger un script qui lui soit propre, et sans lui, elle reste
la liste de toutes les pages.

Elle fonctionne de la même façon sous les deux thèmes. `search: false` dans la
configuration retire le champ et la page.
