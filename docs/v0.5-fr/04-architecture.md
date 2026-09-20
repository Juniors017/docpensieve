---
title: Architecture
description: Comment une page devient du HTML, et pourquoi ainsi.
tags: [architecture]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Architecture

## Le parcours d'une page

```
fichier .md / .mdx
      │
      ▼
  chargement          frontmatter détaché, slug déduit du chemin
      │
      ▼
  compilation         MDX → composant React
      │
      ▼
  rendu               React → chaîne HTML, une fois pour toutes
      │
      ▼
  coquille            en-tête, menu, sommaire, pied de page
      │
      ▼
  page écrite         un dossier, un index.html
```

Une fois chaque page écrite, et **seulement alors**, la feuille de style est
compilée : un thème utilitaire a besoin de savoir quelles classes ont
réellement servi.

## React ne sort pas de la génération

Les composants sont rendus en HTML pendant la génération. Les pages ne chargent
aucun runtime : ce qui parvient au lecteur, c'est du balisage et une feuille de
style, plus les quelques lignes du bouton clair / sombre ; la page de recherche
y ajoute un script, de quelques kilo-octets, pour filtrer sa liste.

Cela explique la forme des composants livrés. Aucun n'a d'état ni d'écouteur
d'événement, puisque rien ne viendrait les animer. Tout ce qui demande une
interaction passe par un élément natif — `details` pour déplier, un lien pour
se déplacer — ou par le CSS.

Cette contrainte est aussi ce qui garantit qu'une page reste lisible dans dix
ans : il n'y a rien qui puisse cesser de fonctionner.

## Les gabarits ne rendent pas le contenu

Un moteur de gabarits construit la coquille : en-tête, menu, sommaire,
sélecteur de version, pied de page. Le contenu, lui, vient de la compilation
MDX.

Les deux ne se mélangent pas, et c'est voulu. Le contenu est écrit par l'auteur
et peut contenir n'importe quoi ; la coquille est écrite une fois et ne doit
jamais dépendre de ce que contient une page.

## Les paquets

```
shared        constantes, erreurs, slugs — ne dépend de rien
core          configuration, chargement, compilation, JSON-LD, génération
theme         les habillages, chacun répondant au même contrat
components    les composants disponibles dans les pages
cli           les commandes
```

**Le graphe ne remonte jamais.** Le moteur n'importe ni les habillages ni les
composants : ce sont les commandes qui les lui remettent. C'est ce qui permet
de le tester sans React ni CSS, et ce qui empêche une dépendance circulaire de
s'installer sans qu'on la voie.

## Les créneaux du thème

Les gabarits ne contiennent aucune classe. Ils demandent au thème la classe de
chaque créneau, et le thème répond — une classe simple, ou une poignée
d'utilitaires.

Deux conséquences pratiques :

- changer d'habillage ne demande de toucher à aucun gabarit ;
- un habillage n'a besoin de redéfinir que ce qu'il change.

Les composants suivent la même règle, avec un repli : sans réponse, ils
prennent une classe `dp-*` que leur propre feuille habille à partir des jetons
du thème. Ils suivent donc la palette active sans rien savoir d'elle.

## Les adresses

Une cible relative se résout depuis le dossier du fichier de la page. Une cible
absolue part de la **racine de la version**, pas du domaine : une documentation
ne sait pas qu'elle peut être servie sous un sous-chemin.

Cette réécriture a lieu sur l'arbre issu du Markdown — donc **avant** que les
composants ne soient rendus. Un composant qui produit une adresse doit donc la
résoudre lui-même, en suivant les mêmes règles. C'est pourquoi chaque page
rendue est annoncée aux composants, comme leur est annoncée la table des
classes.

## Rien n'échoue en silence

C'est la règle qui traverse toutes les autres. Une valeur inconnue, un parent
manquant, un fichier introuvable : chacun arrête la génération avec un message
et une piste.

L'alternative — rendre un élément vide, ignorer une propriété, retomber sur une
valeur par défaut — produit des pages qui ont l'air justes et ne le sont pas.
Ces défauts-là ne se découvrent qu'en production, longtemps après.

Celles qu'elle produit vraiment, avec la forme que chacune prend à l'écran,
sont rassemblées par symptôme dans [Quand ça casse](./guide/when-it-breaks/).
