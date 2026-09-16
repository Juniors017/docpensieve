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

Nothing yet: the 0.3 has just opened. Each change is listed here as it lands,
beside what it asks of a project already built on the 0.2.
