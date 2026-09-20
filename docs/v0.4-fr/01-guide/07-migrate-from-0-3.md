---
title: Migrer de la 0.3 vers la 0.4
description: Faire passer un projet de la 0.3 à la 0.4 — ce qui change tout seul, et ce qu'il vaut la peine d'activer.
tags: [guide, migration]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Migrer de la 0.3 vers la 0.4

Un projet en 0.3 se génère avec la 0.4 tel quel : tous les champs que la 0.4
ajoute sont facultatifs, et les laisser de côté garde le site que vous avez.

## Mettre à jour

```bash
npm install docpensieve@latest
```

Par `npx` seul, `npx docpensieve` la lance déjà.

Relisez votre site une fois après la mise à jour — c'est le contrôle le moins
cher qui soit :

```bash
npx docpensieve build
npx docpensieve check
```

## Ce qui change tout seul

**Sur un écran étroit, le menu de la documentation se replie désormais au-dessus
du contenu** au lieu de rester ouvert entre l'en-tête et le texte. Rien à
configurer, et rien à défaire : sur un écran large, le menu est inchangé.

Rien d'autre ne bouge. Vos pages, votre configuration et votre dossier de thème
sont lus exactement comme avant.

## Ce qu'il vaut la peine d'activer

Chacun tient en une ligne de `docpensieve.config.mjs`. Aucun ne dépend d'un
autre.

### Un menu qui se replie

Passé une vingtaine de pages, un menu qui montre tout demande au lecteur de
faire défiler ce qui ne le concerne pas :

```js
foldedSidebar: true,
```

Les catégories se replient, et la branche de la page lue s'ouvre d'elle-même.
Une catégorie qui est aussi une page garde sa page en première entrée — la
poignée d'un repli ne peut pas être un lien.

### Des liens dans l'en-tête

```js
headerLinks: [
  { label: 'Blog', href: '/blog/' },
  { label: 'Dépôt', href: 'https://example.com/repo' },
],
```

Une cible part de la racine d'une version, ou est une adresse complète. Une
entrée portant `columns` ouvre un panneau au lieu de mener quelque part ;
`href` et `columns` ensemble sont refusés, une entrée faisant l'un ou l'autre.

Voir [Navigation](./navigation/) pour le panneau et pour ce qui se passe sur un
téléphone.

### Un en-tête qui défile

```js
stickyHeader: false,
```

L'en-tête rend sa hauteur au texte au lieu de se tenir en haut de l'écran. Il
reste retenu par défaut.

### Des blocs mis à part

Six types sont livrés — `note`, `info`, `tip`, `attention`, `alert`, `danger` —
et ne demandent aucune configuration :

```mdx
<Admonition type="attention">À lire avant de mettre à jour.</Admonition>
```

Vos propres types prennent un libellé et un ton :

```js
admonitions: {
  review: { label: 'À relire', tone: 'attention' },
},
```

Un type que personne n'a déclaré arrête la génération plutôt que de rendre un
bloc sans couleur ni libellé. Voir [Admonition](../../components/admonition/).

### Des icônes issues d'un jeu

À côté d'un fichier de votre projet, `LogoIcon` accepte le nom d'une icône
d'une collection :

```bash
npm install --save-dev @iconify-json/simple-icons
```

```mdx
<LogoIcon src="simple-icons:github" label="Dépôt" />
```

Le jeu est lu à la génération et le dessin posé dans la page : aucune requête
ne part du navigateur de votre lecteur. Voir
[LogoIcon](../../components/logo-icon/).

### Un site en plusieurs langues

Une version déclare le dossier de chaque traduction, servie sous son code :

```js
translations: { fr: 'docs/v1.0-fr' },
```

La langue du site garde ses adresses, et une page non traduite n'est pas
proposée dans cette langue plutôt que servie dans une autre. Voir
[Langues](./languages/).

## Ce qu'il faut vérifier ensuite

- **Votre propre CSS**, si le dossier de thème habille l'en-tête ou le menu :
  le menu replié ajoute des éléments `details` et `summary` là où il n'y avait
  que des liens, et un en-tête statique ne porte plus `position: sticky`.
- **Un lien vers un titre**, si vous avez désactivé l'en-tête collant :
  l'espace réservé au-dessus d'une ancre disparaît avec lui, et c'est le but.
- **`npx docpensieve check`**, qui relit le site produit et signale les liens
  morts et le balisage invalide.

Rien de tout cela n'est obligatoire. Un projet qui n'active rien est un projet
0.3 qui se trouve tourner sur la 0.4.
