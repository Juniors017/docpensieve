---
title: What's new in 0.2
description: What the 0.2 brings, what it is still to bring, and what it changes for a 0.1 project.
tags: [release]
---

# What's new in 0.2

This version is **in preparation**. It is not published on npm yet: the
version you install today is the 0.1, documented in the 0.1 pages of this
site. What follows is written as each piece lands, and describes the 0.2 as it
stands.

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

## Still to come

| Piece            | What it brings                                                    |
| ---------------- | ----------------------------------------------------------------- |
| Search           | A search field, over an index of each version built with the site |
| Optimisation     | A minified stylesheet, lighter images                             |
| API and examples | The reference of each package, complete example projects          |

## For a 0.1 project

Nothing to change: a 0.1 configuration builds as it is. `sidebar: 'auto'`
stays the default, and every new field is optional. A guide to moving from
0.1 to 0.2 will come with the release.
