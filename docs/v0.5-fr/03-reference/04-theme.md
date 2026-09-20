---
title: Thème
description: Créneaux, jetons et options d'habillage, un à un.
tags: [référence, thème]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Thème

Pour apprendre à s'en servir, voir [Thèmes](../guide/themes/). Cette page liste
ce qui existe.

## Les options

```js
theme: {
  framework: 'tailwind',
  darkMode: 'class',
  tokens: { '--dp-accent': 'oklch(55% 0.2 250)' },
  css: '.dp-article h2 { letter-spacing: -0.01em; }',
  source: '@import "tailwindcss";',
},
```

| Champ       | Défaut                   | Effet                                                                                                                 |
| ----------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `framework` | `'tailwind'`             | `'tailwind'` ou `'custom'`                                                                                            |
| `darkMode`  | `'class'`                | `'class'` : le système du lecteur, sauf si une classe sur `<html>` en décide. `'dark'` ou `'light'` pose cette classe |
| `toggle`    | `true`                   | Un bouton clair / sombre dans l'en-tête, retenu de page en page                                                       |
| `tokens`    | —                        | Jetons `--dp-*` redéfinis, fusionnés avec ceux du provider                                                            |
| `css`       | `''`                     | CSS ajouté à la feuille produite                                                                                      |
| `source`    | `@import "tailwindcss";` | Feuille remise au compilateur utilitaire                                                                              |

`source` ne concerne que le provider `tailwind` : c'est la feuille d'entrée
qu'il compile. La remplacer permet d'ajouter des directives — un bloc `@theme`,
par exemple — sans sortir du mécanisme. Les directives `@plugin` ne sont pas
encore prises en charge et arrêtent la génération.

## Les jetons

Vingt et un jetons, que les deux providers définissent et que les composants
lisent. Un jeton redéfini se propage partout, sans qu'aucun composant ait à le
savoir — dans la palette **claire** : les valeurs sombres vivent dans la
feuille du thème, et se redéfinissent dans le dossier `theme/` du projet.

| Jeton                 | Rôle                                               |
| --------------------- | -------------------------------------------------- |
| `--dp-bg`             | Fond de page                                       |
| `--dp-bg-soft`        | Fond des zones en creux — pistes de jauge, survols |
| `--dp-text`           | Texte courant                                      |
| `--dp-text-soft`      | Texte secondaire — légendes, pieds de carte        |
| `--dp-border`         | Bordures visibles                                  |
| `--dp-rule`           | Filets discrets — séparateurs d'arborescence       |
| `--dp-accent`         | Couleur d'accent — liens, remplissages             |
| `--dp-accent-soft`    | Fond d'accent — bandeaux                           |
| `--dp-tip`            | Ton d'un bloc de conseil — bordure et titre        |
| `--dp-tip-soft`       | Son fond                                           |
| `--dp-attention`      | Ton d'un bloc qui met en garde                     |
| `--dp-attention-soft` | Son fond                                           |
| `--dp-danger`         | Ton d'un bloc qui dit ce que coûte un faux pas     |
| `--dp-danger-soft`    | Son fond                                           |
| `--dp-shadow`         | Couleur des ombres portées                         |
| `--dp-radius`         | Arrondi des angles                                 |
| `--dp-font`           | Famille de caractères du texte                     |
| `--dp-font-mono`      | Famille à chasse fixe — code, arborescences        |
| `--dp-content-width`  | Largeur de lecture. `none` par défaut              |
| `--dp-sidebar-width`  | Colonne du menu                                    |
| `--dp-toc-width`      | Colonne du sommaire                                |

Certains composants ajoutent les leurs, documentés sur leur page :
`--dp-skill-size` pour une jauge circulaire, `--dp-skill-color` pour sa teinte,
`--dp-logo-icon-size` pour une icône.

## Les créneaux

Les gabarits n'écrivent aucune classe. Ils demandent la classe de chaque
créneau, et le thème répond. Un provider ne redéfinit que ce qu'il change ;
tout le reste garde la classe `dp-*` ci-dessous.

| Créneau         | Classe par défaut             | Où                                                  |
| --------------- | ----------------------------- | --------------------------------------------------- |
| `skip`          | `dp-skip`                     | Lien d'évitement vers le contenu                    |
| `header`        | `dp-header`                   | En-tête du site                                     |
| `headerStatic`  | `dp-header dp-header--static` | L'en-tête quand il défile                           |
| `brand`         | `dp-brand`                    | Nom du projet, dans l'en-tête                       |
| `brandLogo`     | `dp-brand-logo`               | Logo à côté du nom du projet                        |
| `versions`      | `dp-versions`                 | Sélecteur de version                                |
| `versionsList`  | `dp-versions-list`            | Liste ouverte du sélecteur                          |
| `languages`     | `dp-languages`                | Sélecteur de langue, quand une version est traduite |
| `languagesList` | `dp-languages-list`           | Liste ouverte de ce sélecteur                       |
| `shell`         | `dp-shell`                    | Grille menu / contenu / sommaire                    |
| `shellWide`     | `dp-shell dp-shell--wide`     | La même, sans menu ni sommaire                      |
| `sidebar`       | `dp-sidebar`                  | Colonne du menu                                     |
| `nav`           | `dp-nav`                      | Liste de navigation                                 |
| `navItem`       | `dp-nav-item`                 | Entrée de navigation                                |
| `navItemParent` | `dp-nav-item--parent`         | Entrée qui contient une section                     |
| `navLink`       | `dp-nav-link`                 | Lien de navigation                                  |
| `navLabel`      | `dp-nav-label`                | Libellé de section, non cliquable                   |
| `notice`        | `dp-notice`                   | Bandeau des versions qui ne sont pas la courante    |
| `skillIcon`     | `dp-skill-icon`               | Icône devant le nom d'une jauge                     |
| `main`          | `dp-main`                     | Zone principale                                     |
| `article`       | `dp-article`                  | Contenu de la page                                  |
| `toc`           | `dp-toc`                      | Colonne du sommaire                                 |
| `tocTitle`      | `dp-toc-title`                | Titre du sommaire                                   |
| `tocList`       | `dp-toc-list`                 | Liste du sommaire                                   |
| `tocItem`       | `dp-toc-item`                 | Entrée du sommaire                                  |
| `footer`        | `dp-footer`                   | Pied de page                                        |
| `scrollTop`     | `dp-scroll-top`               | Bouton de retour en haut                            |
| `scrollTopIcon` | `dp-scroll-top-icon`          | Flèche de ce bouton                                 |
| `search`        | `dp-search`                   | Champ de recherche de l'en-tête                     |
| `schemeToggle`  | `dp-scheme-toggle`            | Bouton clair / sombre de l'en-tête                  |
| `headerNav`     | `dp-header-nav`               | Versions, liens et recherche, en rangée             |
| `headerLinks`   | `dp-header-links`             | Liens de l'en-tête                                  |
| `menu`          | `dp-menu`                     | Bouton de menu, sur écran étroit                    |
| `menuPanel`     | `dp-menu-panel`               | Ce que ce bouton ouvre                              |
| `navGroup`      | `dp-nav-group`                | Une catégorie repliée du menu                       |
| `navSummary`    | `dp-nav-summary`              | La poignée de ce repli                              |
| `sidebarMenu`   | `dp-sidebar-menu`             | Le menu de la documentation, sur écran étroit       |
| `mega`          | `dp-mega`                     | Une entrée d'en-tête qui ouvre un panneau           |
| `megaPanel`     | `dp-mega-panel`               | Ce panneau                                          |
| `megaColumn`    | `dp-mega-column`              | Une colonne du panneau                              |
| `megaTitle`     | `dp-mega-title`               | Le titre d'une colonne                              |
| `byline`        | `dp-byline`                   | Auteurs et dates en tête de page                    |
| `bylineAuthors` | `dp-byline-authors`           | Liste des auteurs                                   |
| `bylineAuthor`  | `dp-byline-author`            | Un auteur                                           |
| `bylineAvatar`  | `dp-byline-avatar`            | Portrait d'un auteur                                |
| `bylineName`    | `dp-byline-name`              | Nom d'un auteur                                     |
| `bylineBio`     | `dp-byline-bio`               | Biographie d'un auteur                              |
| `bylineDates`   | `dp-byline-dates`             | Dates d'écriture et de mise à jour                  |
| `tags`          | `dp-tags`                     | Étiquettes en bas de page                           |
| `tag`           | `dp-tag`                      | Une étiquette                                       |

Un créneau peut porter des **variantes**, suffixées `--variante` : `column`
donne `dp-column--span-8`, `skill` donne `dp-skill--circle`.

## Comment un créneau est rendu

Toujours en **triple accolade**, dans les gabarits :

```hbs
<nav class="{{{cls.sidebar}}}">
```

Une double accolade échapperait le contenu, et une classe utilitaire telle que
`aria-[current=page]` deviendrait `aria-[current&#x3D;page]` — un sélecteur
muet, sans la moindre erreur.

## Les feuilles de style

La feuille livrée est assemblée à partir de quatre morceaux, dans cet ordre :

| Feuille              | Contenu                                                      |
| -------------------- | ------------------------------------------------------------ |
| `structure.css`      | Grille, colonnes collantes, accessibilité. Partagée par tous |
| `prose.css`          | Typographie du contenu                                       |
| une peau ou un pont  | `custom.css`, ou `tailwind-bridge.css`                       |
| celle des composants | Les règles `dp-*` des composants livrés                      |

Vient ensuite ce que le projet ajoute : `theme.css`, puis chaque fichier `.css`
de son dossier `theme/`, dans l'ordre des noms.

La mise en page n'est **jamais** dupliquée dans un provider : elle vit dans
`structure.css`, que les deux partagent. Un provider ne s'occupe que de
l'habillage.

## Ordre des couches

Sous le thème `tailwind`, la feuille déclare ses couches dans cet ordre :

```css
@layer theme, base, components, utilities;
```

Les règles des composants vivent dans `components`, **sous** les utilitaires.
Un `className` posé à l'emploi l'emporte donc toujours, quelle que soit la
place de la règle dans le fichier.

Le thème `custom` n'a pas de couche d'utilitaires : ses feuilles ne sont dans
aucune couche, et viennent donc avant les règles des composants, qui restent
dans la couche `components`.

Ce qu'ajoutent `theme.css` et le dossier `theme/` n'est dans aucune couche :
sans couche, une règle l'emporte sur toutes celles qui en ont une. C'est ce qui
permet d'y écrire un correctif sans se soucier de spécificité.
