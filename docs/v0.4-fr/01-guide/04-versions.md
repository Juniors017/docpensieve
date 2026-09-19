---
title: Versions
description: Garder côte à côte la version en ligne et celle qui se prépare.
tags: [guide, versions]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Versions

Une version, c'est un **dossier de sources** et une **entrée de
configuration**. Rien d'autre. Tout le reste — adresse, menu, sélecteur,
branche — en découle.

## Le modèle à deux voies

C'est l'arrangement le plus courant, et celui qu'emploie la documentation de
DocPensieve :

| Version      | Rôle                                            | Qui la voit               |
| ------------ | ----------------------------------------------- | ------------------------- |
| **courante** | celle qui est en ligne et reçoit les correctifs | tout le monde, par défaut |
| **bêta**     | celle qui se prépare pour la sortie suivante    | ceux qui la choisissent   |

Un visiteur qui arrive à la racine est envoyé vers la **courante**. La bêta
existe, elle est atteignable, mais personne n'y atterrit par hasard.

## 1. Déclarer les versions

Dans `docpensieve.config.mjs` :

```js
versions: [
  { slug: 'v1.1-beta', name: '1.1 (beta)', folder: 'docs/v1.1-beta', prerelease: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
],
```

| Champ        | Rôle                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `slug`       | Identifiant d'adresse et de branche. Il apparaît dans `/versions/<slug>/` |
| `name`       | Ce que le visiteur lit dans le sélecteur                                  |
| `folder`     | Dossier des sources, relatif à la racine du projet                        |
| `current`    | La version servie par défaut. **Au plus une**                             |
| `archived`   | Version conservée mais qui ne reçoit plus de correctifs                   |
| `prerelease` | Version en préparation, pas encore la courante                            |

Deux règles à retenir :

- **une seule version peut porter `current`** — deux arrêtent la génération ;
- si **aucune** ne la porte, la première de la liste devient courante. Une
  configuration à une seule version n'a donc rien à préciser.

Le sélecteur n'apparaît dans l'en-tête qu'à partir de **deux** versions : un
choix unique n'est pas un choix.

### Nommer une version : le numéro ou le canal

Le `slug` est l'adresse. Deux conventions, et le choix n'est pas neutre.

**Le numéro** — `v1.0`, `v1.1` — donne à chaque version une adresse qui ne
bouge jamais : un lien pris aujourd'hui mène aux mêmes pages dans deux ans.
Mais l'adresse ne peut porter que ce qui reste vrai pour toute une série.
`v1.0` nomme encore la documentation une fois la `1.0.7` sortie : l'adresse en
dit donc moins que le sélecteur, qui affiche la version exacte.

**Le canal** — `latest`, `beta` — nomme le rôle à la place. L'adresse que
partage un lecteur reste juste pour toujours : `/versions/latest/` mène
toujours à la documentation qui compte, `/versions/beta/` à celle qui se
prépare. Ce qui bouge, c'est ce qu'il y a derrière — le jour de la sortie,
`latest` devient la nouvelle version, et celle qu'elle remplace prend un slug
numéroté en passant aux archives : son contenu gèle, donc son adresse peut
geler avec lui.

Aucune n'est meilleure. Prenez le numéro si vos lecteurs renvoient vers une
version précise, le canal s'ils renvoient vers « la documentation ». La
documentation de DocPensieve prend le canal : ses versions sont `latest` et
`beta`.

## 2. Ouvrir la bêta

Partez de la version courante, et donnez-lui son propre dossier :

```bash
cp -r docs/v1.0 docs/v1.1-beta
```

Déclarez ensuite l'entrée avec `prerelease` — et **sans** `current`, que la
version courante conserve :

```js
versions: [
  { slug: 'v1.1-beta', name: '1.1 (beta)', folder: 'docs/v1.1-beta', prerelease: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
],
```

`prerelease` n'est pas qu'une étiquette. Il pose sur **chaque page** de la
version un bandeau qui renvoie vers la courante, et un
`<meta name="robots" content="noindex, follow">` dans l'en-tête du document.

Ce second point compte plus qu'il n'y paraît. Une bêta est une copie presque
identique de la version courante : sans cela, les deux se disputent la même
place dans les moteurs de recherche, et c'est souvent la mauvaise qui remonte.
Quelqu'un lirait alors une documentation en cours en croyant lire celle qui
compte. `follow` laisse tout de même suivre les liens de la page.

Une version ne peut être à la fois `current` et `prerelease` : la génération
s'arrête. Le bandeau de l'une contredirait le rôle de l'autre.

```bash
npx docpensieve build
npx docpensieve serve
```

Le sélecteur propose désormais les deux. La racine mène toujours à la `1.0`.

À partir de là, les deux dossiers vivent leur vie : ce que vous écrivez dans
`docs/v1.1-beta` ne touche pas la documentation en ligne.

### Un correctif qui vaut pour les deux

Corriger une faute dans la version courante ne la corrige pas dans la bêta :
ce sont deux dossiers distincts. C'est le prix des versions figées, et il se
paie à chaque correctif — le reporter dans les deux dossiers fait partie du
travail.

## 3. Promouvoir la bêta

Le jour de la sortie, la bêta devient la version courante. Une seule chose
change : **où se trouve `current`**.

```js
versions: [
  { slug: 'v1.1', name: '1.1', folder: 'docs/v1.1', current: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', archived: true },
],
```

En pratique, trois étapes :

1. renommer le dossier `docs/v1.1-beta` en `docs/v1.1` ;
2. dans la configuration, changer le `slug`, le `name`, le `folder`, et
   déplacer `current` ;
3. retirer `prerelease` de la nouvelle, et marquer l'ancienne `archived`.

```bash
npx docpensieve build
```

`archived` dit que la version ne recevra plus de correctifs. Elle **reste en
ligne** : ce n'est pas une extinction, c'est une information. Ses pages portent
aussi un bandeau vers la version courante, mais **restent indexées** — une
version passée compte encore pour ceux qui l'utilisent.

> **Le `slug` change en même temps que le dossier, et l'adresse avec.**
> `/versions/v1.1-beta/` disparaît au profit de `/versions/v1.1/`, et les liens
> externes qui visaient la bêta ne mènent plus nulle part. Deux issues : garder
> le même slug du début à la fin — `v1.1` d'emblée, seule l'étiquette
> mentionnant la bêta — ou nommer le canal plutôt que le numéro, `beta` puis
> `latest`, qui ne bouge jamais. Voir _Nommer une version_ plus haut.

## Ce que produit la génération

```
dist/
├── index.html          redirection vers la version courante
├── versions.json       la liste, pour qui veut la lire
└── versions/
    ├── v1.1-beta/
    └── v1.0/
```

La racine est une **redirection HTML**, pas une règle de serveur : la sortie
reste publiable sur n'importe quel hébergeur statique, sans configuration.

`versions.json` décrit chaque version — son slug, son libellé, son adresse, si
elle est courante, si elle est archivée.

## Générer une seule version

```bash
npx docpensieve build v1.1-beta
```

Seule cette version est écrite, dans `versions/v1.1-beta/`. Les autres ne sont
pas touchées — pratique pour travailler la bêta sans vouloir regénérer le
reste.

Une réserve : cette forme n'écrit **ni le manifeste ni la redirection de
racine**, qui ne concernent aucune version en particulier. Après avoir ajouté,
renommé ou retiré une version, lancez une génération complète.

## Une branche par version

Le modèle va plus loin que le dossier : chaque version compilée peut vivre sur
sa **propre branche orpheline**, nommée d'après son slug, avec un historique
séparé de celui des sources.

L'enjeu n'est pas le stockage, c'est le temps. Une version publiée il y a deux
ans reste ce qu'elle était, dans l'état où elle a été produite — sans dépendre
du générateur d'aujourd'hui ni des sources d'aujourd'hui. La regénérer n'est
jamais nécessaire, et rien ne garantirait qu'elle donne le même résultat.

Les sources restent sur la branche de travail. Les deux ne se mélangent jamais.

À quoi ressemble le jour d'une sortie vu du dehors — les adresses, la chaîne
d'intégration, le contrôle qui arrête une mauvaise publication — est dans
[Déploiement](./deployment/).
