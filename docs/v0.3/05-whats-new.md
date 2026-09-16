---
title: What's new in 0.3
description: What the 0.3 brings, and what it changes for a 0.2 project.
tags: [release]
---

# What's new in 0.3

This version is **out**. It is what `npx docpensieve init my-site` installs,
and what the `latest` pages of this site document:

```bash
npm install docpensieve@latest
```

## What it brings

### Authors at the head of a page

A page carrying `authors`, `date` or `modified` now opens with a byline: who
wrote it, and when. The names show as written; a JSON file of the version,
named by `authors: 'authors.json'`, adds a biography, an avatar and a link —
and feeds the page data with them. See
[Who wrote the page](./guide/writing-pages/) in the guide, and the
[`authors` field](./reference/configuration/) in the reference.

### Series and cards

A folder is a series: its `index` page introduces it, and the pages beside
that index are its instalments. The `Cards` component turns that structure
into a grid of clickable cards — title, description, image, number of pages,
update date — instead of an index list written by hand, which goes stale at
the first page renamed. See [Cards](./components/cards/).

### Tags at the bottom of a page

The `tags` of a page, read until now only by its structured data, show at the
bottom of the page, below the text they describe. See
[The frontmatter](./guide/writing-pages/) in the guide.

### Description files, optional per version

A `sidebar` or `authors` file named in the configuration no longer has to
exist in every version folder. A version without it keeps the menu of its
folders, or shows the names its pages give: describing the menu or the authors
of a new version no longer forces a copy into the older ones. A file present
but unreadable, or wrongly written, still stops the build.

### Header links, and a menu on narrow screens

`headerLinks` adds links to the header, beside the version switcher — each may
name the version it leads to, so that a section written in one version is
reachable from all of them. On a narrow screen, the switcher, the links and the
search field move behind a menu button, which opens without a script. See the
[`headerLinks` field](./reference/configuration/).

## For a 0.2 project

Nothing to change: a 0.2 configuration builds as it is.
[Migrate from 0.2 to 0.3](./guide/migrate-from-0-2/) lists what changes on
its own, what to check, and what is worth turning on.
