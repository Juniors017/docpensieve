---
title: Frontmatter
description: Les champs reconnus en tête d'une page, et ce qu'ils produisent.
tags: [référence, frontmatter]

jsonld:
  type: TechArticle
  breadcrumbs: true
  faq:
    - question: Le frontmatter est-il obligatoire ?
      answer: Non. Sans titre, le nom du projet prend le relais ; sans date, aucune date n'est publiée.
    - question: Comment garder une page hors ligne ?
      answer: 'Posez draft: true dans son frontmatter. Elle reste dans le dépôt, absente de la sortie.'
---

# Frontmatter

Un bloc YAML en tête du fichier, entre deux lignes de trois tirets. Tout y est
facultatif.

```yaml
---
title: Installation
description: Ce qu'il faut, et comment mettre un projet en place.
date: 2026-09-09
modified: 2026-09-14
authors: [Valentin Chevoleau]
tags: [guide, installation]
preview: ./capture.png
draft: false
layout: doc

jsonld:
  type: TechArticle
  breadcrumbs: true
---
```

## Les champs

| Champ         | Effet                                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| `title`       | Balise `<title>`, entrée de menu, fil d'Ariane, `headline` du JSON-LD             |
| `description` | Métadonnée `description` et `description` du JSON-LD                              |
| `date`        | Date de publication                                                               |
| `modified`    | Date de dernière modification. Défaut : la date de publication. Dans la signature |
| `authors`     | Auteurs de la page, par nom ou par clé du fichier d'auteurs de la version         |
| `tags`        | Affichés en bas de page, et repris en `keywords` dans le JSON-LD                  |
| `preview`     | Image de la page. Le chemin se résout comme un lien                               |
| `draft`       | `true` garde la page hors de la sortie                                            |
| `layout`      | `doc` (défaut) ou `home`                                                          |
| `jsonld`      | Réglages des données structurées                                                  |

## `layout`

`doc` est la mise en page de documentation : menu à gauche, sommaire à droite,
contenu tenu à la largeur de lecture.

`home` retire les trois. C'est ce qu'attend une page d'accueil, où colonnes et
cartes prennent toute la surface.

```yaml
layout: home
```

Une valeur inconnue arrête la génération. Une faute de frappe rendrait sinon la
page dans une autre mise en page que celle voulue, sans un mot.

## `jsonld`

```yaml
jsonld:
  type: TechArticle
  breadcrumbs: true
  faq:
    - question: Faut-il un frontmatter ?
      answer: Non, tout y est facultatif.
```

| Champ         | Effet                                        |
| ------------- | -------------------------------------------- |
| `type`        | `Article`, `TechArticle` ou `BlogPosting`    |
| `breadcrumbs` | `false` retire le fil d'Ariane               |
| `faq`         | Questions et réponses, publiées en `FAQPage` |

Chaque entrée de `faq` doit porter `question` **et** `answer` : s'il en manque
une, la génération s'arrête et le dit.

Les questions doivent **aussi figurer dans le texte de la page**. Les moteurs
de recherche rejettent un balisage qui décrit un contenu invisible : une FAQ
présente dans le seul frontmatter expose la page à perdre ses données
structurées.

Un `type` hors de la liste est refusé de la même façon. Cette page même porte
une `faq` : son JSON-LD contient le bloc.

## Ce qu'il n'y a pas à écrire

L'adresse, la place dans le menu, le fil d'Ariane et le lien `canonical`
découlent du chemin du fichier et de la configuration. Rien à répéter dans le
frontmatter, et rien à tenir à jour quand un fichier est déplacé.

## Questions fréquentes

### Le frontmatter est-il obligatoire ?

Non. Sans titre, le nom du projet prend le relais ; sans date, aucune date n'est publiée.

### Comment garder une page hors ligne ?

Posez `draft: true` dans son frontmatter. Elle reste dans le dépôt, absente de la sortie.

Ce que ces champs deviennent une fois la page générée — l'ordre du menu, la
signature, les étiquettes sous le texte — est dans
[Écrire des pages](../guide/writing-pages/).
