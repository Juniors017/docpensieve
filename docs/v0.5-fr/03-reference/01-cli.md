---
title: Commandes
description: init, build, check, dev et serve, avec leurs arguments et leurs options.
tags: [référence, cli]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Commandes

```bash
npx docpensieve <commande> [arguments] [options]
```

## `init`

Met en place un projet de documentation.

```bash
npx docpensieve init [dossier]
```

| Option                     | Effet                                          |
| -------------------------- | ---------------------------------------------- |
| `[dossier]`                | Dossier cible. Défaut : `.`                    |
| `-n, --name <nom>`         | Nom du projet                                  |
| `-t, --theme <framework>`  | `tailwind` ou `custom`                         |
| `-u, --site-url <url>`     | Adresse publique du site                       |
| `--version-name <version>` | Première version, `1.0` par exemple            |
| `-y, --yes`                | Accepte les valeurs par défaut sans dialogue   |
| `-f, --force`              | Écrase une configuration existante             |
| `--minimal`                | Laisse la documentation de DocPensieve de côté |

Sans `--force`, la commande refuse d'écraser une configuration existante.

Sans terminal interactif — un script, une intégration continue, ou un terminal
qui ne donne aucune entrée interactive aux programmes qu'il lance — la commande
ne demande rien : elle le dit, puis s'en tient aux options et aux défauts.
`--yes` rend ce choix explicite et fait taire l'annonce.

Sauf `--minimal`, la commande installe la documentation de DocPensieve dans le
nouveau site, sous `docs/<version>/99-docpensieve/` : une section
**DocPensieve** à la fin du menu, correspondant à la version installée.
Supprimez ce dossier quand vous n'en avez plus besoin.

Sous le thème `custom`, la commande écrit aussi `theme/custom.css`, où vont les
classes du projet, et — avec la documentation — `theme/99-docpensieve.css`, les
classes de ses exemples, à supprimer avec elle. Un `theme/custom.css` existant
n'est jamais écrasé, même avec `--force`.

## `build`

Génère le site.

```bash
npx docpensieve build [version]
```

| Option            | Effet                                                    |
| ----------------- | -------------------------------------------------------- |
| `[version]`       | Slug de version. Omis, toutes les versions sont générées |
| `-o, --out <dir>` | Dossier de sortie. Défaut : celui de la configuration    |

Avec un slug, seule cette version est écrite, dans `versions/<slug>/`. Cette
forme n'écrit **ni le manifeste ni la redirection de racine** : après avoir
ajouté ou retiré une version, lancez une génération complète.

## `check`

Relit le site produit : liens internes et balisage.

```bash
npx docpensieve check
```

| Option            | Effet                                                   |
| ----------------- | ------------------------------------------------------- |
| `-d, --dir <dir>` | Dossier à contrôler. Défaut : celui de la configuration |

### Les liens

- une cible qui **ignore le préfixe de déploiement** — le fichier existe, mais
  le lien ne mènera nulle part une fois en ligne. C'est le symptôme d'une
  adresse qui a échappé à la résolution ;
- une cible qui **ne correspond à aucun fichier produit**.

Les cibles externes, les ancres et les `mailto:` sont laissées tranquilles. Une
cible qui revient plusieurs fois dans une page n'est signalée qu'une fois.

### Le balisage

- un **paragraphe imbriqué** dans un autre ;
- un **paragraphe dans un élément qui n'accepte que du texte**, un `span` par
  exemple ;
- un **élément de bloc dans un paragraphe**, un titre par exemple.

Ils viennent généralement de la même source, décrite dans
[Écrire des pages](../guide/writing-pages/) : le contenu d'une balise JSX laissé
seul sur sa ligne devient un paragraphe. Le navigateur défait alors
l'imbrication en silence, l'enveloppe disparaît, et la mise en page voulue avec
elle.

S'il reste quelque chose à corriger, la commande sort en code 1 : elle fait
donc échouer une intégration continue sans réglage particulier.

## `dev`

Serveur de développement, qui régénère à chaque enregistrement.

```bash
npx docpensieve dev
```

| Option                | Effet                          |
| --------------------- | ------------------------------ |
| `-p, --port <numéro>` | Port d'écoute. Défaut : `3000` |

## `serve`

Sert le dossier de sortie statiquement, sans rien regénérer.

```bash
npx docpensieve serve
```

| Option                | Effet                          |
| --------------------- | ------------------------------ |
| `-p, --port <numéro>` | Port d'écoute. Défaut : `4000` |
| `-d, --dir <dir>`     | Dossier à servir               |

C'est la commande qui reproduit fidèlement ce que fera un hébergeur : pour
vérifier ce qui sera publié, enchaînez `build` puis `serve`.

## Codes de sortie

| Code | Signification                                                   |
| ---- | --------------------------------------------------------------- |
| `0`  | Tout s'est bien passé                                           |
| `1`  | Erreur attendue — message et piste affichés, sans pile d'appels |
| `2`  | Fonctionnalité pas encore écrite                                |

Une erreur inattendue sort avec sa pile complète : c'est un défaut du
générateur, pas de la documentation qu'on lui donne.
