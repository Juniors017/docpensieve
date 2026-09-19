---
title: Déploiement
description: Publier le site, et garder les versions passées en ligne.
tags: [guide, déploiement]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Déploiement

## Le préfixe de déploiement

C'est le réglage qui casse le plus de sites, et le seul qu'il faille vraiment
comprendre.

Un site servi à la racine d'un domaine n'a rien à régler. Un site servi sous un
sous-chemin — `https://example.com/mon-projet/` — doit le savoir, sans quoi
tous ses liens internes pointeront un cran trop haut.

```js
siteUrl: 'https://example.com/mon-projet',
```

Le sous-chemin de `siteUrl` **suffit** : `baseUrl` en découle quand il n'est
pas renseigné. Le poser ne sert qu'à s'en écarter.

```js
siteUrl: 'https://example.com/mon-projet',
baseUrl: '/autre-chemin/',
```

## Générer pour la mise en ligne

```bash
npx docpensieve build
```

Le dossier de sortie se suffit à lui-même : des fichiers HTML, une feuille de
style par version, les ressources copiées. Aucune règle de serveur n'est
nécessaire — la racine est une redirection HTML, et chaque page est un dossier
avec son `index.html`.

## Intégration continue

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'

      - run: npx docpensieve build

      # Une génération réussie ne dit rien d'un lien mort.
      - run: npx docpensieve check

      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

La source des pages doit être réglée sur « GitHub Actions » dans les paramètres
du dépôt : sinon l'artefact est produit mais jamais servi.

Un projet créé par `init` n'a pas de `package.json` : la recette appelle donc
l'outil par `npx`, qui prend la dernière version publiée. Pour la figer d'une
génération à l'autre, déclarez `docpensieve` dans un `package.json` et ajoutez
`npm ci` avant la génération.

## Relire avant de publier

Un site généré peut compiler sans erreur et contenir des liens morts.

```bash
npx docpensieve check
```

La commande sort en code 1 s'il en reste : placée après la génération, elle
arrête la publication plutôt que de mettre en ligne un site dont les liens ne
mènent nulle part. C'est le seul garde-fou qui regarde le résultat plutôt que
les sources.

## Une génération programmée

Ce qui dépend du moment est figé à la génération. Une page qui affiche « l'offre
se termine demain » le dira encore dans six mois si le site n'a pas été
regénéré.

Pour ces pages, une génération périodique suffit :

```yaml
on:
  schedule:
    - cron: '0 4 * * *'
```

## Garder les versions passées

Les versions déjà publiées n'ont pas besoin d'être regénérées : leur sortie est
celle produite à l'époque, et rien ne garantirait qu'une regénération donne le
même résultat des années plus tard.

Le modèle à branches y répond — chaque version compilée sur sa propre branche
orpheline, avec son historique. Voir [Versions](./versions/).

## Moteurs de recherche et lecteurs de flux

Avec `siteUrl` renseigné, la génération écrit `sitemap.xml` à la racine du
site — toutes les versions publiées, une version en préparation exceptée.
Donnez son adresse aux moteurs qui vous importent ; `robots.txt` la leur nomme
quand le site se trouve à la racine de son domaine.

Pour les pages qui relèvent de l'actualité plutôt que de la référence — notes
de version, journal des changements — donnez-leur une `date` et posez
`feed: true` : `feed.xml` les liste alors, la plus récente d'abord. Les champs
sont dans la [référence de configuration](../../reference/configuration/).

## Ce que télécharge le lecteur

La génération allège d'elle-même. La feuille de style est minifiée — un tiers à
la moitié de moins. Chaque image d'une page reçoit sa largeur et sa hauteur,
lues dans son fichier, pour que le texte ne saute pas à son arrivée, et toutes
sauf la première se chargent en différé, quand le lecteur en approche. Il n'y a
rien à configurer.
