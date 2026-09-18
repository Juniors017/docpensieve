---
title: What's new in 0.4
description: What the 0.4 brings, and what it changes for a 0.3 project.
tags: [release]
---

# What's new in 0.4

This version is **in preparation**. Its betas go out under the npm tag `beta`,
while the version installed by default stays the 0.3, documented in the
`latest` pages of this site:

```bash
npx docpensieve@beta init my-site
```

## Already there

The 0.4 has just opened. What follows is what it already brings, and the rest of
its pages are still those of the 0.3. Each feature is announced here as it lands,
with a link to the guide and to the reference — this page announces, it is never
the only place something is written.

### A menu that folds, and a panel of links in the header

`foldedSidebar: true` folds the categories of the menu, open on the branch the
reader stands in. On a narrow screen the whole menu folds above the content,
whatever that setting. And a `headerLinks` entry carrying `columns` opens a
panel of links instead of leading anywhere — declared on its own, so a site can
navigate from the header alone, or from both. See
[the configuration reference](./reference/configuration/).

## For a 0.3 project

Nothing to change: a 0.3 configuration builds as it is.
[Migrate from latest to beta](./guide/migrate-to-beta/) lists what changes on
its own, what to check, and what is worth turning on.
