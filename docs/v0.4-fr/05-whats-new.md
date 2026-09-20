---
title: Nouveautés de la 0.4
description: Ce qu'apporte la 0.4, et ce qu'elle change pour un projet en 0.3.
tags: [sortie]
---

# Nouveautés de la 0.4

La 0.4 est sortie, et s'installe par défaut :

```bash
npx docpensieve init mon-site
```

Chaque nouveauté ci-dessous renvoie au guide et à la référence : cette page les
rassemble, elle n'est jamais le seul endroit où quelque chose est écrit.

## Ce qu'elle apporte

La 0.4 allume la navigation. Un site de quarante pages demandait à son lecteur
de faire défiler ce qui ne le concernait pas ; il peut désormais replier son
menu, porter ses propres liens dans l'en-tête, et mettre un passage à part au
milieu d'une page.

### Un menu qui se replie

`foldedSidebar: true` replie les catégories du menu de la documentation, et
ouvre la branche où se trouve le lecteur. Sur un écran étroit, le menu entier
se replie au-dessus du contenu, quoi que dise ce réglage — rien à configurer
pour celui-là. Voir [Navigation](./guide/navigation/).

### Des liens et des panneaux dans l'en-tête

Une entrée `headerLinks` ajoute un lien à côté du sélecteur de version. Une
entrée portant `columns` ouvre un **panneau** de liens au lieu de mener quelque
part, si bien qu'un site peut naviguer depuis le seul en-tête, depuis le seul
menu, ou depuis les deux avec des liens différents. Un champ `version` fait
pointer toutes les versions vers une seule, ce qui est ainsi que ce site mène à
ses exemples. Voir [Navigation](./guide/navigation/) et
[la référence de configuration](./reference/configuration/).

### Un en-tête retenu, ou non

`stickyHeader` décide si l'en-tête se tient en haut de l'écran ou défile avec
la page, rendant sa hauteur au texte. Il reste retenu par défaut. Voir
[Navigation](./guide/navigation/).

### Un menu de liens, n'importe où dans une page

Le composant `Menu` pose une rangée de liens là où une page en a besoin — un
sommaire en tête d'une page d'atterrissage, les chapitres d'un guide. Les
entrées se regroupent sous un titre, et la rangée se replie derrière un bouton
sur un écran étroit, sans script. Voir [Menu](./components/menu/).

### Des blocs mis à part

`Admonition` sort un passage du texte et dit comment le lire : `note`, `info`,
`tip`, `attention`, `alert`, `danger`. Un projet déclare **ses propres types**
dans le champ `admonitions` — un libellé et un ton pris au thème — pour que
cette liste n'ait pas à grandir chaque fois qu'une équipe a besoin d'un bloc.
Voir [Admonition](./components/admonition/).

### Des icônes issues d'un jeu

`LogoIcon` accepte le nom d'une icône d'une collection, écrit
`simple-icons:github`, à côté d'un fichier de votre projet. Le jeu est un
paquet que votre projet installe et le dessin est posé dans la page à la
génération, comme toute autre icône : votre lecteur ne télécharge rien, et
aucune requête ne part de son navigateur. Un type d'admonition prend sa marque
de la même façon. Voir [LogoIcon](./components/logo-icon/).

### Un site en plusieurs langues

Une version déclare le dossier de chaque traduction :

```js
versions: [
  { slug: 'latest', name: '1.0', folder: 'docs/v1.0', current: true,
    translations: { fr: 'docs/v1.0-fr' } },
],
```

La langue du site garde les adresses qu'elle a, et une traduction est servie
sous son code — `/versions/latest/fr/`. La coquille suit : l'anglais et le
français sont livrés avec l'outil, et le champ `ui` corrige un mot ou ajoute
une langue. Une page que personne n'a traduite n'est pas proposée dans cette
langue plutôt que servie dans une autre. Voir [Langues](./guide/languages/).

## Pour un projet en 0.3

Rien à changer : une configuration 0.3 se génère telle quelle, tous les
nouveaux champs étant facultatifs.
[Migrer de la 0.3 vers la 0.4](./guide/migrate-from-0-3/) liste ce qui change
tout seul, et ce qu'il vaut la peine d'activer.
