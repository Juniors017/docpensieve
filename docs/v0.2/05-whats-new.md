---
title: What's new in 0.2
description: What the 0.2 brings, what it is still to bring, and what it changes for a 0.1 project.
tags: [release]
---

# What's new in 0.2

This version is **in preparation**. Its betas go out under the npm tag `beta`,
while the version installed by default stays the 0.1, documented in the 0.1
pages of this site:

```bash
npx docpensieve@beta init my-site
```

What follows describes the 0.2 as it stands, and
[Migrate from latest to beta](./guide/migrate-to-beta/) says what to check in a 0.1 project.

## Already there

### A menu written by hand

`sidebar: 'sidebar.json'` replaces the menu derived from the file tree with
one you describe — pages in the order you want, categories, links outside the
site. Each version reads its own file, since each has its own pages. A section
can keep its automatic menu with a single entry, which is how the DocPensieve
section stays whole without listing its pages.

See [Writing the menu by hand](./guide/writing-pages/) in the guide, and the
[`sidebar` field](./reference/configuration/) in the reference.

### Search engines and feed readers

With `siteUrl` set, the build writes `sitemap.xml` for search engines — and
`robots.txt` when the site sits at the root of its domain. `feed: true` adds an
RSS feed of the dated pages. See [Sitemap and feed](./reference/configuration/)
in the reference.

### Search

A search field in the header, and a search page in each version. The index is
built with the site, and the field is a plain form: only the search page loads
a script of its own, and without it the page stays the list of every page. See
[Search](./reference/configuration/) in the reference.

### A colour scheme of your choosing, and a logo per version

`theme.darkMode: 'dark'` keeps the site dark whatever the reader's system —
`'light'` keeps it light; `'class'`, the default, still follows the system.
Until now the field was accepted and did nothing. A version can also carry its
own `logo` and `favicon`, to tell a beta apart at a glance. See the
[configuration reference](./reference/configuration/).

### A light / dark switch

A button in the header switches between light and dark, and remembers the
choice from page to page. It is on by default — a few lines of inline script
in every page; `theme.toggle: false` removes it, and pages then load no script.

### Lighter pages

The stylesheet reaches the reader minified. Every image of a page gets its
width and height, read from its file, so that the text no longer jumps when it
arrives; all but the first load lazily, and are no longer preloaded — the
first, often in view, keeps its normal loading. `CardImage` loads lazily too.

### The API reference, and two example projects

Every export of the five packages is in the [API reference](./reference/api/),
generated from the JSDoc of the sources, so that it cannot drift from the code.
The repository also holds two complete example projects, one per theme, built
and checked on every run of its tests.

## For a 0.1 project

Nothing to change: a 0.1 configuration builds as it is. `sidebar: 'auto'`
stays the default, and every new field is optional. A guide to moving from
0.1 to 0.2 will come with the release.
