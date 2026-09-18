---
title: Theme
description: Slots, tokens and styling options, one by one.
tags: [reference, theme]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Theme

To learn how to use it, see [Themes](../guide/themes/). This page lists what
exists.

## The options

```js
theme: {
  framework: 'tailwind',
  darkMode: 'class',
  tokens: { '--dp-accent': 'oklch(55% 0.2 250)' },
  css: '.dp-article h2 { letter-spacing: -0.01em; }',
  source: '@import "tailwindcss";',
},
```

| Field       | Default                  | Effect                                                                                                    |
| ----------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `framework` | `'tailwind'`             | `'tailwind'` or `'custom'`                                                                                |
| `darkMode`  | `'class'`                | `'class'`: the reader's system, unless a class on `<html>` decides. `'dark'` or `'light'` sets that class |
| `toggle`    | `true`                   | A light / dark button in the header, remembered from page to page                                         |
| `tokens`    | —                        | Redefined `--dp-*` tokens, merged with the provider's                                                     |
| `css`       | `''`                     | CSS appended to the produced stylesheet                                                                   |
| `source`    | `@import "tailwindcss";` | Stylesheet handed to the utility compiler                                                                 |

`source` only concerns the `tailwind` provider: it is the entry stylesheet it
compiles. Replacing it lets you add directives — a `@theme` block, for
instance — without leaving the mechanism. `@plugin` directives are not
supported yet and stop the build.

## The tokens

Fifteen tokens, which both providers define and the components read. A
redefined token propagates everywhere, without any component having to know.

| Token                | Role                                                |
| -------------------- | --------------------------------------------------- |
| `--dp-bg`            | Page background                                     |
| `--dp-bg-soft`       | Background of recessed areas — gauge tracks, hovers |
| `--dp-text`          | Body text                                           |
| `--dp-text-soft`     | Secondary text — captions, card footers             |
| `--dp-border`        | Visible borders                                     |
| `--dp-rule`          | Discreet rules — tree separators                    |
| `--dp-accent`        | Accent colour — links, fills                        |
| `--dp-accent-soft`   | Accent background — banners                         |
| `--dp-shadow`        | Colour of drop shadows                              |
| `--dp-radius`        | Corner rounding                                     |
| `--dp-font`          | Font family of the text                             |
| `--dp-font-mono`     | Monospaced family — code, trees                     |
| `--dp-content-width` | Reading width. `none` by default                    |
| `--dp-sidebar-width` | Menu column                                         |
| `--dp-toc-width`     | Table of contents column                            |

Some components add their own, documented on their page: `--dp-skill-size` for
a circle gauge, `--dp-skill-color` for the tint of a gauge,
`--dp-logo-icon-size` for an icon.

## The slots

The templates write no class. They ask for the class of each slot, and the
theme answers. A provider only redefines what it changes; everything else keeps
the `dp-*` class below.

| Slot            | Default class                 | Where                                           |
| --------------- | ----------------------------- | ----------------------------------------------- |
| `skip`          | `dp-skip`                     | Skip link to the content                        |
| `header`        | `dp-header`                   | Site header                                     |
| `headerStatic`  | `dp-header dp-header--static` | The header when it scrolls away                 |
| `brand`         | `dp-brand`                    | Project name, in the header                     |
| `brandLogo`     | `dp-brand-logo`               | Logo beside the project name                    |
| `versions`      | `dp-versions`                 | Version switcher                                |
| `versionsList`  | `dp-versions-list`            | Open list of the switcher                       |
| `shell`         | `dp-shell`                    | Menu / content / table of contents grid         |
| `shellWide`     | `dp-shell dp-shell--wide`     | The same, without menu or table of contents     |
| `sidebar`       | `dp-sidebar`                  | Menu column                                     |
| `nav`           | `dp-nav`                      | Navigation list                                 |
| `navItem`       | `dp-nav-item`                 | Navigation entry                                |
| `navItemParent` | `dp-nav-item--parent`         | Entry that holds a section                      |
| `navLink`       | `dp-nav-link`                 | Navigation link                                 |
| `navLabel`      | `dp-nav-label`                | Section label, not clickable                    |
| `notice`        | `dp-notice`                   | Banner of the versions that are not the current |
| `skillIcon`     | `dp-skill-icon`               | Icon before the name of a gauge                 |
| `main`          | `dp-main`                     | Main area                                       |
| `article`       | `dp-article`                  | Page content                                    |
| `toc`           | `dp-toc`                      | Table of contents column                        |
| `tocTitle`      | `dp-toc-title`                | Title of the table of contents                  |
| `tocList`       | `dp-toc-list`                 | List of the table of contents                   |
| `tocItem`       | `dp-toc-item`                 | Entry of the table of contents                  |
| `footer`        | `dp-footer`                   | Page footer                                     |
| `scrollTop`     | `dp-scroll-top`               | Back-to-top button                              |
| `scrollTopIcon` | `dp-scroll-top-icon`          | Arrow of that button                            |
| `search`        | `dp-search`                   | Search field of the header                      |
| `schemeToggle`  | `dp-scheme-toggle`            | Light / dark button of the header               |
| `headerNav`     | `dp-header-nav`               | Versions, links and search, in a row            |
| `headerLinks`   | `dp-header-links`             | Links of the header                             |
| `menu`          | `dp-menu`                     | Menu button, on a narrow screen                 |
| `menuPanel`     | `dp-menu-panel`               | What that button opens                          |
| `navGroup`      | `dp-nav-group`                | A folded category of the menu                   |
| `navSummary`    | `dp-nav-summary`              | The handle of that fold                         |
| `sidebarMenu`   | `dp-sidebar-menu`             | The documentation menu, on a narrow screen      |
| `mega`          | `dp-mega`                     | A header entry that opens a panel               |
| `megaPanel`     | `dp-mega-panel`               | That panel                                      |
| `megaColumn`    | `dp-mega-column`              | A column of the panel                           |
| `megaTitle`     | `dp-mega-title`               | The title of a column                           |
| `byline`        | `dp-byline`                   | Authors and dates at the head of a page         |
| `bylineAuthors` | `dp-byline-authors`           | List of the authors                             |
| `bylineAuthor`  | `dp-byline-author`            | One author                                      |
| `bylineAvatar`  | `dp-byline-avatar`            | Avatar of an author                             |
| `bylineName`    | `dp-byline-name`              | Name of an author                               |
| `bylineBio`     | `dp-byline-bio`               | Biography of an author                          |
| `bylineDates`   | `dp-byline-dates`             | Writing and update dates                        |
| `tags`          | `dp-tags`                     | Tags at the bottom of a page                    |
| `tag`           | `dp-tag`                      | One tag                                         |

A slot can carry **variants**, suffixed `--variant`: `column` gives
`dp-column--span-8`, `skill` gives `dp-skill--circle`.

## How a slot is rendered

Always in **triple braces**, in the templates:

```hbs
<nav class="{{{cls.sidebar}}}">
```

Double braces would escape the content, and a utility class such as
`aria-[current=page]` would become `aria-[current&#x3D;page]` — a silent
selector, without the slightest error.

## The stylesheets

The delivered stylesheet is assembled from four pieces, in this order:

| Stylesheet          | Content                                            |
| ------------------- | -------------------------------------------------- |
| `structure.css`     | Grid, sticky columns, accessibility. Shared by all |
| `prose.css`         | Typography of the content                          |
| a skin or a bridge  | `custom.css`, or `tailwind-bridge.css`             |
| the components' one | The `dp-*` rules of the shipped components         |

Then comes what the project adds: `theme.css`, then every `.css` file of its
`theme/` folder, in name order.

The layout is **never** duplicated in a provider: it lives in `structure.css`,
which both share. A provider only takes care of the styling.

## Layer order

Under the `tailwind` theme, the stylesheet declares its layers in this order:

```css
@layer theme, base, components, utilities;
```

Component rules live in `components`, **below** the utilities. A `className`
set at use therefore always wins, whatever the place of the rule in the file.

The `custom` theme has no utility layer: its stylesheets are in no layer, and
therefore come before the component rules, which stay in the `components`
layer.

What `theme.css` and the `theme/` folder add is in no layer: without a layer, a
rule wins over all those that have one. That is what lets you write a fix there without worrying
about specificity.
