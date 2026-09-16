---
title: Configuration
description: Every field of docpensieve.config.mjs, its default value and its effect.
tags: [reference, configuration]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Configuration

The `docpensieve.config.mjs` file, at the root of the project.

It is an ES module — hence `.mjs`, which Node reads as one whatever the
project's `package.json` says. `docpensieve.config.js` works too, in a project
whose `package.json` declares `"type": "module"`; with both files present, the
build stops rather than pick one.

```js
/** @type {import('@docpensieve/core').DocPensieveConfig} */
export default {
  projectName: 'My documentation',
  siteUrl: 'https://example.com/my-project',

  versions: [{ slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true }],

  outDir: 'dist',

  theme: {
    framework: 'tailwind',
    darkMode: 'class',
  },

  sidebar: 'auto',
  globalComponents: true,
  jsonld: { enabled: true },
};
```

The `@type` comment gives autocompletion and type checking in the editor
without importing anything: the file stays readable even where DocPensieve
only runs through `npx`. In a project that installs it as a dependency,
`defineConfig` from `@docpensieve/core` does the same.

`docpensieve init` writes this file with **every field** in it — set to its
default, or commented out with an example — so that it also tells you what you
can change.

## The fields

| Field              | Default             | Effect                                                                             |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| `projectName`      | `'Documentation'`   | Name shown in the header and in the JSON-LD                                        |
| `siteUrl`          | `''`                | Public URL. Used for the `canonical` and the JSON-LD                               |
| `baseUrl`          | `'/'`               | Deployment prefix. Derived from `siteUrl` when omitted                             |
| `outDir`           | `'dist'`            | Output folder, relative to the root                                                |
| `versions`         | `[]`                | At least one entry                                                                 |
| `theme`            | see below           | Styling                                                                            |
| `sidebar`          | `'auto'`            | `'auto'`: the menu follows the file tree. Or a `.json` file of each version folder |
| `globalComponents` | `true`              | Shipped components available without an import                                     |
| `scrollToTop`      | `true`              | Back-to-top button on every page                                                   |
| `jsonld`           | `{ enabled: true }` | Structured data                                                                    |
| `lang`             | `'en'`              | Language of the document, in `<html lang>`. The shell's labels stay English        |
| `logo`             | `''`                | Image beside the project name, in the header                                       |
| `favicon`          | `''`                | Icon of the browser tab: `.ico`, `.png` or `.svg`                                  |
| `socialImage`      | `''`                | Preview of a shared page. Needs `siteUrl`                                          |
| `sitemap`          | `true`              | `sitemap.xml` of the published versions, once `siteUrl` is set                     |
| `feed`             | `false`             | RSS feed of the dated pages. Needs `siteUrl`                                       |
| `search`           | `true`              | Search field in the header, and a search page built with the site                  |

## Images

```js
logo: 'branding/logo.png',
favicon: 'branding/favicon.png',
socialImage: 'branding/social.png',
```

The paths start from the project root. Each image is copied into every
version, under `assets/`, so that a version stays whole on its own branch.

- `logo` sits beside the project name, at the height of the header's text: a
  square image reads best there. Its `alt` stays empty, since the name follows
  it. It is also the logo of the organisation in the structured data.
- `favicon` is the icon of the browser tab: `.ico`, `.png` or `.svg`.
- `socialImage` is what a social network shows of a shared page, with its
  title and description. 1200 × 630 pixels is the usual size, and SVG is not
  read there. Those networks only read an absolute address, hence `siteUrl`.

A declared image that does not exist stops the build, naming the field.

## Sitemap and feed

```js
siteUrl: 'https://example.com',
sitemap: true, // the default
feed: true,
```

Once `siteUrl` is set, the build writes `sitemap.xml` at the root of the site:
every page of every version, except a version in preparation, whose pages
carry `noindex`. Each page is dated by its `modified` frontmatter, or failing
that its `date`. `sitemap: false` turns it off.

`robots.txt` joins it when the site is served at the root of its domain.
Search engines only read that file there: under a sub-path, it would be
written for nobody — declare the sitemap to them directly.

`feed: true` writes `feed.xml`, an RSS feed of the pages of the current version
that carry a `date`, newest first, and every page announces it in its head.
It is off by default: most documentation pages carry no date.

Both list absolute addresses: asked for without `siteUrl`, they stop the build.

## Search

`search: true`, the default, puts a search field in the header and builds a
search page in each version, at `/search/`. The build writes the index of the
version — the plain text of every page — and the search page already lists
every page with its description.

The field is a plain form that leads to that page: it needs no script. The
search page loads one of its own, of a few kilobytes, which filters
the list as you type, best matches first, with an excerpt of each. Without
JavaScript, the page stays the full list of pages.

The search page is kept out of search engines (`noindex`) and out of the
sitemap. A page of your own at `/search/` would take its place: the build
refuses it, and `search: false` frees the address.

## `versions`

```js
versions: [
  { slug: 'v2.0', name: '2.0', folder: 'docs/v2.0', current: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', archived: true },
],
```

| Field        | Role                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `slug`       | URL and branch identifier. A number (`v1.0`) freezes the address; a channel (`latest`, `beta`) keeps it right as versions move |
| `name`       | Label shown in the switcher                                                                                                    |
| `folder`     | Source folder, relative to the root                                                                                            |
| `current`    | Version served by default. At most one                                                                                         |
| `archived`   | Version kept but no longer maintained. Banner, but stays indexed                                                               |
| `prerelease` | Version in preparation. Banner **and** `noindex`                                                                               |
| `logo`       | This version's logo, instead of the project's — a beta told apart at a glance                                                  |
| `favicon`    | This version's favicon, instead of the project's                                                                               |

## `theme`

```js
theme: {
  framework: 'tailwind',
  darkMode: 'class',
  tokens: { '--dp-accent': 'oklch(55% 0.2 250)' },
  css: '.dp-article h2 { letter-spacing: -0.01em; }',
  source: '@import "tailwindcss";',
},
```

| Field       | Effect                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `framework` | `'tailwind'` or `'custom'`                                                                                                          |
| `darkMode`  | `'class'` follows the reader's system; `'dark'` or `'light'` keeps one scheme                                                       |
| `toggle`    | On by default: a light / dark button in the header, remembered from page to page — a few lines of inline script. `false` removes it |
| `tokens`    | Redefined `--dp-*` tokens                                                                                                           |
| `css`       | CSS appended to the produced stylesheet                                                                                             |
| `source`    | Stylesheet handed to the utility compiler                                                                                           |

The available tokens are listed in [Themes](../guide/themes/).

Longer rules go in the `theme/` folder, at the root of the project: every
`.css` file in it is appended after `css`, in name order, and
`docpensieve dev` picks up every change. Under the `custom` theme, `init`
starts it with `theme/custom.css`.

## `authors`

```js
authors: 'authors.json',
```

Names a JSON file **read in each version folder**, describing the authors a
page names in its frontmatter: a name, a biography, an avatar, a link.

Empty by default, and then a page still shows the names it gives, without the
rest: the file enriches, it does not command. A version without the file shows
the names alone, so describing the authors of a new version does not force a
copy into the older ones. A file present but unreadable, or wrongly written,
stops the build.

The file is not published. The avatars are, their path starting at the version
folder so that they travel with it.

## `sidebar`

`'auto'` builds the menu from the file tree: folders become categories, and the
`01-`, `02-` prefixes set the order. To write it by hand, name a JSON file:

```js
sidebar: 'sidebar.json',
```

It is read from **each version's folder** — `docs/v1.0/sidebar.json` — since
each version has its own pages. A version without the file keeps the menu of
its folders, so a menu written for a new version needs no copy in the older
ones. The file holds an array of entries, kept in the order written:

```json
[
  "/",
  { "label": "Guide", "page": "guide", "items": ["guide/installation", "guide/first-site"] },
  { "page": "reference/cli", "label": "Commands" },
  { "auto": "docpensieve" },
  { "label": "Repository", "href": "https://github.com/me/my-project" }
]
```

| Entry                           | What it gives                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `"guide/installation"`          | A page, by its path within the version, as in its URL — `"/"` for the home page |
| `{ "page", "label" }`           | The same page, with a label of its own                                          |
| `{ "label", "items", "page"? }` | A category, clickable when it names a page                                      |
| `{ "label", "href" }`           | A link outside the site                                                         |
| `{ "auto": "folder" }`          | The automatic menu of a folder: the DocPensieve section keeps its own this way  |

A page left out stays published: it is only absent from the menu. A path that
names no page, a page listed twice, or an entry of no known kind stops the
build, naming the file and the paths close to the one written. The file itself
is not published.

## `baseUrl`, and why you rarely write it

A `siteUrl` with a sub-path already gives it: `https://example.com/my-project`
produces `baseUrl: '/my-project/'`. Writing it is only useful to depart from
it.

The prefix is normalised with both its slashes. It is what prefixes every
internal link: if it is wrong, every link is.

## What is refused

| Case                               | Message                           |
| ---------------------------------- | --------------------------------- |
| The configuration is not an object | An example of the expected export |
| No version declared                | An example of a complete entry    |
| Two versions with the same slug    | The offending slug                |
| Several `current` versions         | The list of those found           |
| Unknown `framework`                | The accepted values               |
| Requested slug not found           | The available slugs               |
| An image of the wrong kind         | The accepted extensions           |
| `socialImage` without `siteUrl`    | Why the address is needed         |
| A declared image that is missing   | The field and its path            |

Each one stops the build with a message and a hint, without a stack trace.

## What is filled in automatically

If **no** version carries `current`, the first in the list becomes current. A
single-version configuration therefore has nothing to specify — this field only
starts to matter from the second version on.
