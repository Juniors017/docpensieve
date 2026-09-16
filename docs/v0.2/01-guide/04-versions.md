---
title: Versions
description: Keep the current version and the one being prepared side by side.
tags: [guide, versions]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Versions

A version is a **source folder** and a **configuration entry**. Nothing else.
Everything else — URL, menu, switcher, branch — follows from them.

## The two-track model

It is the most common arrangement, and the one DocPensieve's own documentation uses:

| Version     | Role                                        | Who sees it          |
| ----------- | ------------------------------------------- | -------------------- |
| **current** | the one that is online and being fixed      | everyone, by default |
| **beta**    | the one being prepared for the next release | those who pick it    |

A visitor arriving at the root is sent to the **current** one. The beta exists,
it is reachable, but nobody lands there by chance.

## 1. Declaring the versions

In `docpensieve.config.mjs`:

```js
versions: [
  { slug: 'v1.1-beta', name: '1.1 (beta)', folder: 'docs/v1.1-beta', prerelease: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
],
```

| Field        | Role                                                          |
| ------------ | ------------------------------------------------------------- |
| `slug`       | URL and branch identifier. It shows up in `/versions/<slug>/` |
| `name`       | What the visitor reads in the switcher                        |
| `folder`     | Source folder, relative to the project root                   |
| `current`    | The version served by default. **At most one**                |
| `archived`   | Version kept but no longer receiving fixes                    |
| `prerelease` | Version in preparation, not yet the current one               |

Two rules to remember:

- **only one version can carry `current`** — two stop the build;
- if **none** carries it, the first in the list becomes current. A
  single-version configuration therefore has nothing to specify.

The switcher only appears in the header from **two** versions on: a single
choice is not a choice.

### Naming a version: the number or the channel

The `slug` is the address. Two conventions, and the choice is not neutral.

**The number** — `v1.0`, `v1.1` — gives each version an address that never
moves: a link captured today leads to the same pages in two years. But the
address can only carry what stays true for a whole series. `v1.0` still names
the documentation once `1.0.7` is out, so the URL says less than the switcher,
which reads the exact version.

**The channel** — `latest`, `beta` — names the role instead. The address a
reader shares stays right for ever: `/versions/latest/` always leads to the
documentation that counts, `/versions/beta/` to the one being prepared. What
moves is what sits behind it — on release day, `latest` becomes the new
version, and the one it replaces takes a numbered slug as it is archived: its
content freezes, so its address can freeze with it.

Neither is better. Take the number if your readers link to a precise version,
the channel if they link to "the documentation". DocPensieve's own
documentation takes the channel: its versions are `latest` and `beta`.

## 2. Opening the beta

Start from the current version, and give it its own folder:

```bash
cp -r docs/v1.0 docs/v1.1-beta
```

Then declare the entry with `prerelease` — and **without** `current`, which the
current version keeps:

```js
versions: [
  { slug: 'v1.1-beta', name: '1.1 (beta)', folder: 'docs/v1.1-beta', prerelease: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', current: true },
],
```

`prerelease` is not just a label. It puts on **every page** of the version a
banner pointing to the current one, and a
`<meta name="robots" content="noindex, follow">` in the head.

This second point matters more than it seems. A beta is a near-identical copy
of the current version: without it, both compete for the same place in search
engines, and it is often the wrong one that comes up. Someone would then read a
documentation in progress while believing they read the one that counts.
`follow` still lets the page's links be followed.

A version cannot be both `current` and `prerelease`: the build stops. The
notice of one would contradict the role of the other.

```bash
npx docpensieve build
npx docpensieve serve
```

The switcher now offers both. The root still leads to `1.0`.

From there, the two folders live their own lives: what you write in
`docs/v1.1-beta` does not touch the online documentation.

### A fix that applies to both

Fixing a typo in the current version does not fix it in the beta: they are two
separate folders. It is the price of frozen versions, and it is paid at every
fix — carrying it over into both folders is part of the work.

## 3. Promoting the beta

On release day, the beta becomes the current version. Only one thing changes:
**where `current` sits**.

```js
versions: [
  { slug: 'v1.1', name: '1.1', folder: 'docs/v1.1', current: true },
  { slug: 'v1.0', name: '1.0', folder: 'docs/v1.0', archived: true },
],
```

In practice, three steps:

1. rename the `docs/v1.1-beta` folder to `docs/v1.1`;
2. in the configuration, change the `slug`, the `name`, the `folder`, and move
   `current`;
3. remove `prerelease` from the new one, and mark the old one `archived`.

```bash
npx docpensieve build
```

`archived` says the version will no longer receive fixes. It **stays online**:
it is not a shutdown, it is information. Its pages also carry a banner pointing
to the current version, but **stay indexed** — a past version still matters to
those who use it.

> **The `slug` changes along with the folder, and so does the URL.**
> `/versions/v1.1-beta/` disappears in favour of `/versions/v1.1/`, and the
> external links that pointed to the beta lead nowhere any more. Two ways out:
> keep the same slug from start to finish — `v1.1` from the start, with only
> the label mentioning the beta — or name the channel rather than the number,
> `beta` then `latest`, which never moves. See _Naming a version_ above.

## What the build produces

```
dist/
├── index.html          redirect to the current version
├── versions.json       the list, for whoever wants to read it
└── versions/
    ├── v1.1-beta/
    └── v1.0/
```

The root is an **HTML redirect**, not a server rule: the output stays
publishable on any static host, without configuration.

`versions.json` describes each version — its slug, its label, its URL, whether
it is current, whether it is archived.

## Building a single version

```bash
npx docpensieve build v1.1-beta
```

Only this version is written, in `versions/v1.1-beta/`. The others are not
touched — handy when working on the beta without wanting to rebuild the rest.

One caveat: this form writes **neither the manifest nor the root redirect**,
which concern no version in particular. After adding, renaming or removing a
version, run a full build.

## One branch per version

The model goes further than the folder: each compiled version can live on its
**own orphan branch**, named after its slug, with a history separate from that
of the sources.

The point is not storage, it is time. A version published two years ago stays
what it was, in the state in which it was produced — without depending on
today's generator or today's sources. Rebuilding it is never necessary, and
nothing would guarantee it gives the same result.

The sources stay on the working branch. The two never mix.
