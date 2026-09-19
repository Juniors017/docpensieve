---
title: First site
description: Build, serve, and understand what was produced.
tags: [guide]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# First site

## Building

```bash
npx docpensieve build
```

Every declared version is built. To build just one, pass its slug:

```bash
npx docpensieve build v1.0
```

## Looking at the result

```bash
npx docpensieve serve
```

The output folder is served statically on port 4000. It is exactly what a host
will do: no difference between this server and going live.

## Working

```bash
npx docpensieve dev
```

The development server watches the sources and rebuilds on every save. It
listens on port 3000; `--port` changes that.

The difference with `serve` is this: `dev` rebuilds, `serve` only serves. To
check what will really be published, chain `build` then `serve`.

## What was produced

```
dist/
├── index.html              redirect to the current version
├── versions.json           the versions and their URLs
└── versions/
    └── v1.0/
        ├── index.html      the home page of the version
        ├── assets/
        │   └── docpensieve.css
        └── guide/
            └── installation/
                └── index.html
```

Three things are worth noticing.

**Each page is a folder with an `index.html`.** That is what gives URLs without
an extension — `/guide/installation/` rather than `/guide/installation.html` —
without asking anything of the host.

**A single stylesheet for the whole version.** It is compiled last, once the
pages are written, because a utility theme needs to know which classes were
actually used in order to emit only those.

**The `versions.json` at the root** describes the available versions. It is
what lets versions built long ago stay online without ever rebuilding them.

## Reading the output back

A successful build says nothing of a dead link: nothing in the chain looks at
them. A command takes care of it:

```bash
npx docpensieve build
npx docpensieve check
```

It walks the produced pages, removes the deployment prefix from every internal
target and checks that the file exists. It also reports the targets that
**ignore** that prefix — the file is there, but the link will lead nowhere once
online.

```
  index.html
    /guide/installation/
    → ignores the deployment prefix "/my-project/"
```

It is the check to run after any change of `baseUrl`, of folder structure or of
URL. When something does not add up, [When it breaks](./when-it-breaks/) lists
the failures this tool produces, by the symptom you see.

## Searching the site

Every page carries a search field in its header. It leads to the search page
of the version, at `/search/`, which the build writes with the site: the list
of every page, that a small script filters as the reader types — best matches
first, each with an excerpt. It is the only page to load a script of its own,
and without it, it stays the list of every page.

It works the same under both themes. `search: false` in the configuration
removes the field and the page.
