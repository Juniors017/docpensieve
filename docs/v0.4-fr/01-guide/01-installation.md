---
title: Installation
description: Ce qu'il faut, et comment mettre en place un projet de documentation.
date: 2026-09-09
modified: 2026-09-19
tags: [guide, installation]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Installation

## Ce qu'il faut

**Node.js 22 ou plus récent.** C'est la seule exigence. Le générateur tourne à
la génération, pas du côté du lecteur : rien d'autre à installer sur le serveur
qui hébergera le site, lequel n'a qu'à servir des fichiers.

## Mettre en place un projet

```bash
npx docpensieve init mon-site
cd mon-site
```

La commande crée le dossier et y écrit une configuration, un premier dossier de
documentation et une page d'accueil. Elle pose quelques questions ; `--yes` les
passe et accepte les valeurs par défaut. Là où elle ne peut pas les poser — un
script, une intégration continue, ou un terminal qui ne donne aucune entrée
interactive aux programmes qu'il lance — elle le dit et s'en tient aux options
et aux défauts.

Elle installe aussi cette documentation, dans une section **DocPensieve** à la
fin du menu du nouveau site. Elle correspond à la version que vous avez
installée, et son dossier, `99-docpensieve`, se supprime dès que vous n'en avez
plus besoin ; `--minimal` l'écarte d'emblée. Le fichier de configuration liste
toutes les options, chacune commentée, à sa valeur par défaut ou donnée en
exemple.

```bash
npx docpensieve init mon-site --yes --name "Ma documentation"
```

| Option                     | Effet                                                    |
| -------------------------- | -------------------------------------------------------- |
| `-n, --name <nom>`         | Nom du projet, affiché dans l'en-tête                    |
| `-t, --theme <framework>`  | `tailwind` ou `custom`                                   |
| `-u, --site-url <url>`     | Adresse publique, dont découle le préfixe de déploiement |
| `--version-name <version>` | Première version, `1.0` par exemple                      |
| `-y, --yes`                | Accepte les valeurs par défaut sans dialogue             |
| `-f, --force`              | Écrase une configuration existante                       |
| `--minimal`                | Laisse la documentation de DocPensieve hors du site      |

## L'installer dans un projet

Avec `npx` seul, la version employée est la dernière publiée. Pour figer celle
qu'un projet utilise — ce dont l'intégration continue a besoin — installez-la
dans le projet :

```bash
npm init -y              # seulement si le dossier n'a pas encore de package.json
npm install docpensieve
npx docpensieve init .
```

`npm install` ne fait qu'installer : il ne crée aucun site et ne demande rien —
c'est `init` qui s'en charge. Il installe aussi dans le dossier le plus proche
qui possède un `package.json`, en remontant depuis le dossier courant : dans un
dossier qui n'en a pas, le paquet atterrit dans un dossier parent et rien
n'apparaît là où vous êtes. D'où le `npm init -y` d'abord. `npx docpensieve`
lance ensuite la copie installée.

`init` refuse d'écraser une configuration existante : il faut le demander avec
`--force`. Ce refus est voulu — une configuration écrasée par mégarde ne se
remarque qu'au déploiement suivant.

## Choisir le thème

`tailwind` est le défaut et installe Tailwind en dépendance. `custom` s'en
passe entièrement : le site est alors habillé par une feuille écrite dans le
paquet, sans aucune dépendance de style. Vos propres classes vivent alors dans
le dossier `theme/`, que `init` amorce avec `theme/custom.css`.

Les deux s'emploient de la même façon — les gabarits sont les mêmes, seul
l'habillage change. Le choix n'est pas définitif : il tient dans un champ de la
configuration, décrit dans [Thèmes](./themes/).

## Mettre à jour

```bash
npm install docpensieve@latest
```

Lancé par `npx` seul, DocPensieve ne demande rien : `npx docpensieve` va
chercher la dernière version de lui-même.

Un projet monté avec la 0.1.0 possède un `docpensieve.config.js`. Il fonctionne
encore, mais Node ne le lit comme module que si le `package.json` le déclare, et
avertit à chaque génération sinon : renommez-le `docpensieve.config.mjs`.

La documentation installée par `init` dans `99-docpensieve` reste à la version
qui l'a écrite. Pour la rafraîchir, lancez `init` dans un dossier jetable et
recopiez ce dossier.

Venant de la 0.3, [Migrer vers la bêta](./migrate-to-beta/) dit ce
qui change tout seul et ce qu'il faut vérifier. Pour essayer cette bêta,
installez `docpensieve@beta`, ou lancez `npx docpensieve@beta` seul.

## Vérifier

```bash
npx docpensieve build
```

Si le dossier de sortie apparaît avec un `index.html` dedans, tout est en
place. Ensuite : [Premier site](./first-site/).
