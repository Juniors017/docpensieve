---
title: Migrate from latest to beta
description: Move a project from the latest version, the 0.2, to the 0.3 beta — what changes on its own, and what to check.
tags: [guide, migration]
---

# Migrate from latest to beta

A project on the latest version — the 0.2 — builds with the 0.3 beta as it is:
every new field is optional.

## Update

```bash
npm install docpensieve@beta
```

Through `npx` alone, `npx docpensieve@beta` runs the beta. Going back is
`npm install docpensieve@latest`.

## What changes on its own

| What                                       | In 0.3                                          |
| ------------------------------------------ | ----------------------------------------------- |
| Pages with `authors`, `date` or `modified` | Open with a byline naming the authors and dates |

Nothing to change, but something to know: those three fields already existed,
read by the sitemap and the page data without ever being shown. They are now
shown, so a page that carries them gains a block it did not have. A page that
carries none of them looks exactly as before.

## What to turn on

| Field                        | Gives                                                 |
| ---------------------------- | ----------------------------------------------------- |
| `authors: 'authors.json'`    | Biographies, avatars and links, described per version |
| `<Cards />` in an index page | A grid of cards built from the pages of the folder    |
