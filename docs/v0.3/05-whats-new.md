---
title: What's new in 0.3
description: What the 0.3 brings, and what it changes for a 0.2 project.
tags: [release]
---

# What's new in 0.3

This version is **in preparation**. Its betas go out under the npm tag `beta`,
while the version installed by default stays the 0.2, documented in the
`latest` pages of this site:

```bash
npx docpensieve@beta init my-site
```

## Already there

### Authors at the head of a page

A page carrying `authors`, `date` or `modified` now opens with a byline: who
wrote it, and when. The names show as written; a JSON file of the version,
named by `authors: 'authors.json'`, adds a biography, an avatar and a link —
and feeds the page data with them. See
[Who wrote the page](./guide/writing-pages/) in the guide, and the
[`authors` field](./reference/configuration/) in the reference.

## For a 0.2 project

Nothing to change: a 0.2 configuration builds as it is.
[Migrate from latest to beta](./guide/migrate-to-beta/) lists what changes on
its own, what to check, and what is worth turning on.
