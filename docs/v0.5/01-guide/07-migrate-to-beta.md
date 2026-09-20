---
title: Migrate from latest to beta
description: Move a project from the latest version, the 0.4, to the 0.5 beta — what changes on its own, and what to check.
tags: [guide, migration]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Migrate from latest to beta

A project on the latest version — the 0.4 — builds with the 0.5 beta as it is:
every field the 0.5 adds is optional.

## Update

```bash
npm install docpensieve@beta
```

Through `npx` alone, `npx docpensieve@beta` runs the beta. Going back is
`npm install docpensieve@latest`.

Read your site back once after the update — it is the cheapest check there is:

```bash
npx docpensieve build
npx docpensieve check
```

## What changes on its own

Nothing yet: the 0.5 has just opened. Each change is listed here as it lands,
beside what it asks of a project already built on the 0.4.

## What to check afterwards

- **Your own CSS**, if the theme folder styles anything the beta touches.
- **`npx docpensieve check`**, which reads the built site back and reports dead
  links and invalid markup.
