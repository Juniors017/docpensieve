---
title: Migrer de latest vers la bêta
description: Faire passer un projet de la version courante, la 0.4, à la bêta 0.5 — ce qui change tout seul, et ce qu'il faut vérifier.
tags: [guide, migration]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Migrer de latest vers la bêta

Un projet sur la version courante — la 0.4 — se génère avec la bêta 0.5 tel
quel : tous les champs que la 0.5 ajoute sont facultatifs.

## Mettre à jour

```bash
npm install docpensieve@beta
```

Par `npx` seul, `npx docpensieve@beta` lance la bêta. Le retour en arrière est
`npm install docpensieve@latest`.

Relisez votre site une fois après la mise à jour — c'est le contrôle le moins
cher qui soit :

```bash
npx docpensieve build
npx docpensieve check
```

## Ce qui change tout seul

Rien pour l'instant : la 0.5 vient de s'ouvrir. Chaque changement sera listé
ici à son arrivée, à côté de ce qu'il demande à un projet déjà bâti sur la 0.4.

## Ce qu'il faut vérifier ensuite

- **Votre propre CSS**, si le dossier de thème habille ce que la bêta touche.
- **`npx docpensieve check`**, qui relit le site produit et signale les liens
  morts et le balisage invalide.
