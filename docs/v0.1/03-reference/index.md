---
title: Reference
description: Commands, configuration and frontmatter, field by field.
tags: [reference]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Reference

- **[Commands](./cli/)** — `init`, `build`, `check`, `dev`, `serve`
  and their options.
- **[Configuration](./configuration/)** — every field of
  `docpensieve.config.js`, its default value and its effect.
- **[Frontmatter](./frontmatter/)** — the fields recognised at the top
  of a page.
- **[Theme](./theme/)** — slots, tokens and styling options.

To learn how to use them rather than look them up, the [guide](../guide/) is the
right starting point.

## Errors

Every expected error carries a message and an **actionable hint**. An invalid
configuration, an unknown version slug, a value out of range: each one says
what is wrong and what is expected instead.

Nothing fails silently. A component that cannot render what it is asked for
stops the build rather than produce an inert element — a tag that does nothing
goes unnoticed on review, an error does not.
