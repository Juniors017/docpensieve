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

| Field              | Default             | Effect                                                                      |
| ------------------ | ------------------- | --------------------------------------------------------------------------- |
| `projectName`      | `'Documentation'`   | Name shown in the header and in the JSON-LD                                 |
| `siteUrl`          | `''`                | Public URL. Used for the `canonical` and the JSON-LD                        |
| `baseUrl`          | `'/'`               | Deployment prefix. Derived from `siteUrl` when omitted                      |
| `outDir`           | `'dist'`            | Output folder, relative to the root                                         |
| `versions`         | `[]`                | At least one entry                                                          |
| `theme`            | see below           | Styling                                                                     |
| `sidebar`          | `'auto'`            | `'auto'`: the sidebar follows the file tree. The only value written so far  |
| `globalComponents` | `true`              | Shipped components available without an import                              |
| `scrollToTop`      | `true`              | Back-to-top button on every page                                            |
| `jsonld`           | `{ enabled: true }` | Structured data                                                             |
| `lang`             | `'en'`              | Language of the document, in `<html lang>`. The shell's labels stay English |

## `versions`

```js
versions: [
  { slug: 'v2.0', name: '2.0', folder: 'docs/v2.0', current: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', archived: true },
],
```

| Field        | Role                                                             |
| ------------ | ---------------------------------------------------------------- |
| `slug`       | URL and branch identifier                                        |
| `name`       | Label shown in the switcher                                      |
| `folder`     | Source folder, relative to the root                              |
| `current`    | Version served by default. At most one                           |
| `archived`   | Version kept but no longer maintained. Banner, but stays indexed |
| `prerelease` | Version in preparation. Banner **and** `noindex`                 |

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

| Field       | Effect                                    |
| ----------- | ----------------------------------------- |
| `framework` | `'tailwind'` or `'custom'`                |
| `darkMode`  | Dark theme strategy                       |
| `tokens`    | Redefined `--dp-*` tokens                 |
| `css`       | CSS appended to the produced stylesheet   |
| `source`    | Stylesheet handed to the utility compiler |

The available tokens are listed in [Themes](../guide/themes/).

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

Each one stops the build with a message and a hint, without a stack trace.

## What is filled in automatically

If **no** version carries `current`, the first in the list becomes current. A
single-version configuration therefore has nothing to specify — this field only
starts to matter from the second version on.
