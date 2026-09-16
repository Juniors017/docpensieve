---
title: Deployment
description: Publish the site, and keep past versions online.
tags: [guide, deployment]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Deployment

## The deployment prefix

It is the setting that breaks the most sites, and the only one you really have
to understand.

A site served at the root of a domain has nothing to set. A site served under a
sub-path — `https://example.com/my-project/` — must know it, otherwise every
internal link will point one notch too high.

```js
siteUrl: 'https://example.com/my-project',
```

The sub-path of `siteUrl` **is enough**: `baseUrl` is derived from it when it
is not set. Setting it only serves to depart from it.

```js
siteUrl: 'https://example.com/my-project',
baseUrl: '/other-path/',
```

## Building for going live

```bash
npx docpensieve build
```

The output folder is self-contained: HTML files, one stylesheet per version,
the copied resources. No server rule is needed — the root is an HTML redirect,
and each page is a folder with its `index.html`.

## Continuous integration

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'

      - run: npx docpensieve build

      # A successful build says nothing of a dead link.
      - run: npx docpensieve check

      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

The pages source must be set to "GitHub Actions" in the repository settings:
otherwise the artifact is produced but never served.

A project created by `init` has no `package.json`: the recipe therefore calls
the tool through `npx`, which takes the latest published version. To pin it
from one build to the next, declare `docpensieve` in a `package.json` and add
`npm ci` before the build.

## Reading back before publishing

A generated site can compile without error and contain dead links.

```bash
npx docpensieve check
```

The command exits with code 1 if any remain: placed after the build, it stops
the publication rather than put online a site whose links lead nowhere. It is
the only safeguard that looks at the result rather than at the sources.

## A scheduled build

What depends on the moment is frozen at build time. A page that shows "the
offer ends tomorrow" will still say so in six months if the site has not been
rebuilt.

For those pages, a periodic build is enough:

```yaml
on:
  schedule:
    - cron: '0 4 * * *'
```

## Keeping past versions

Already published versions do not need to be rebuilt: their output is the one
produced at the time, and nothing would guarantee that a rebuild gives the same
result years later.

The branch model answers this — each compiled version on its own orphan branch,
with its history. See [Versions](./versions/).

## Search engines and feed readers

With `siteUrl` set, the build writes `sitemap.xml` at the root of the site —
every published version, a version in preparation excepted. Give its address
to the search engines you care about; `robots.txt` names it for them when the
site sits at the root of its domain.

For pages that are news rather than reference — release notes, a changelog —
give them a `date` and set `feed: true`: `feed.xml` then lists them, newest
first. The fields are in the [configuration reference](../reference/configuration/).

## What the reader downloads

The build keeps it light on its own. The stylesheet is minified — a third to
half lighter. Every image of a page gets its width and height, read from its
file, so that the text does not jump when it arrives, and all but the first
load lazily, when the reader nears them. There is nothing to configure.
