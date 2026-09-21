---
title: Nouveautés de la 0.5
description: Ce qu'apporte la 0.5, et ce qu'elle change pour un projet en 0.4.
tags: [sortie]
---

# Nouveautés de la 0.5

Cette version est **en préparation**. Ses bêtas sortent sous l'étiquette npm
`beta`, tandis que la version installée par défaut reste la 0.4, documentée
dans les pages `latest` de ce site :

```bash
npx docpensieve@beta init mon-site
```

Chaque nouveauté est annoncée ici à mesure qu'elle atterrit, avec un lien vers
le guide et vers la référence : cette page annonce, elle n'est jamais le seul
endroit où quelque chose est écrit.

## Déjà là

### Un bouton qui copie un bloc de code

`copyCode: true` pose un bouton de copie sur chaque bloc de code. C'est la
première chose qu'une page DocPensieve demande à un lecteur de charger : elle
reste donc éteinte tant que vous ne la demandez pas — et alors le comportement
est écrit une fois par version, partagé par toutes les pages et toutes les
langues, et chargé par les seules pages qui contiennent du code. Deux
kilooctets environ, compressés ; aucun framework, aucune hydratation.

C'est la règle du zéro script qui cède la place à une règle qui se mesure :
une page ne charge que ce qu'elle emploie.
[Le champ](./reference/configuration/)

### Un bloc de code qui désigne un fichier

`Snippet` montre un vrai fichier de votre projet, lu à la génération de la
page. Un exemple écrit à la main est une copie, et une copie cesse d'être
vraie le jour où le code change, sans que rien ne le signale. Un intervalle de
lignes ou un repère `#region` en garde une partie ; `collapsed` replie un long
fichier dans un `details`, toujours sans script.

```mdx
<Snippet source="src/index.js" region="guard" />
```

L'idée vient de Christophe Avonture.

[Le composant](./components/snippet/)

### init demande la langue

`init` demande désormais si le site sera en plusieurs langues, et met la
réponse en place : le dossier à côté de vos pages, `translations` écrit dans
la configuration, et une page d'accueil dans cette langue pour démarrer. La
seconde page d'exemple est laissée sans traduction exprès, pour que le menu
montre ce que devient une page non traduite — rien, dans cette langue.

```bash
npx docpensieve init mon-site --translation fr
```

Le code est un code BCP 47 : `fr`, `pt-BR`, `zh-Hans`. Le français et
l'anglais sont livrés avec leurs mots pour la coquille ; toute autre langue
garde l'anglais tant que le champ `ui` ne lui donne pas les siens.

[Les langues](./guide/languages/) · [Les options d'init](./reference/cli/)

## Pour un projet en 0.4

Rien à changer : une configuration 0.4 se génère telle quelle, et un site déjà
en deux langues n'est pas touché — la question ne façonne qu'un **nouveau**
projet.
[Migrer de latest vers la bêta](./guide/migrate-to-beta/) liste ce qui change
tout seul, et ce qu'il vaut la peine d'activer.
