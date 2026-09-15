---
title: Moving from 0.1 to 0.2
description: What the 0.2 changes on its own, what to check, and what to turn on.
tags: [release, migration]
---

# Moving from 0.1 to 0.2

A 0.1 project builds with the 0.2 as it is: every new field is optional.
A few things change on their own, though, and deserve a look.

## Update

```bash
npm install docpensieve@beta   # while the 0.2 is in beta
npm install docpensieve@latest # once it is released
```

Through `npx` alone, `npx docpensieve@beta` runs the beta.

## What changes on its own

| What             | In 0.2                                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| Search           | A field in the header, and a page at `/search/` in each version                |
| `sitemap.xml`    | Written at the root of the site as soon as `siteUrl` is set                    |
| `robots.txt`     | Written with it, when the site is served at the root of its domain             |
| The stylesheet   | Minified                                                                       |
| Images           | Their width and height are written; all but the first of a page load lazily    |
| `theme.darkMode` | Now read: `'dark'` and `'light'` keep one scheme, `'class'` follows the system |

Content pages still load no script: the search page alone does.

## What to check

- **A page of yours at `/search/`** now stops the build: that address is the
  search page's. Rename your page, or set `search: false`.
- **`theme.darkMode`** was accepted and ignored in 0.1. A value other than
  `'class'` now takes effect — and an unknown one stops the build.
- **Your own `robots.txt`**, if you published one next to the site, is now
  written by the build when the site sits at the root of its domain. Set
  `sitemap: false` to keep yours.

## What to turn on

| Field                        | Gives                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| `sidebar: 'sidebar.json'`    | A menu written by hand, in each version's folder              |
| `feed: true`                 | An RSS feed of the pages that carry a `date`                  |
| `versions[].logo`, `favicon` | A logo and a favicon of the version's own — a beta told apart |
| `search: false`              | No search at all, if the site does not need one               |

Every field is in the [configuration reference](./reference/configuration/).
