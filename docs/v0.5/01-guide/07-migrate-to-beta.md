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

- **`dev` and `serve` listen on this machine only.** They used to listen on
  every interface, so anyone on the same network could read the site being
  written. To look at it from a phone on the same wifi, say so:
  `npx docpensieve dev --host 0.0.0.0`.
- **Code blocks carry a background of their own.** A block in a language the
  highlighter does not know used to sit on the bare page; it now looks like
  every other block.
- **An error keeps its hint.** An error the tool raises while a page compiles
  no longer comes out as a generic syntax complaint.

## What is worth turning on

- [Snippet](../components/snippet/), to show a real file rather than a copy.
- [Hero](../components/hero/) and [Calendar](../components/calendar/).
- `copyCode`, a copy button on every code block — off by default, since it is
  what makes a page load a script. See [the reference](../reference/configuration/).
- `snippetIcons`, if your project installs an icon collection.

## What to check afterwards

- **Your own CSS**, if the theme folder styles anything the beta touches.
- **`npx docpensieve check`**, which reads the built site back and reports dead
  links and invalid markup.
