---
title: Installation
description: What you need, and how to set up a documentation project.
date: 2026-09-09
tags: [guide, installation]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Installation

## What you need

**Node.js 22 or later.** It is the only requirement. The generator runs at
build time, not on the reader's side: nothing else to install on the server
that will host the site, which only has to serve files.

## Setting up a project

```bash
npx docpensieve init my-site
cd my-site
```

The command creates the folder and writes a configuration, a first
documentation folder and a home page into it. It asks a few questions; `--yes`
skips them and accepts the defaults.

It also installs this very documentation, in a **DocPensieve** section at the
end of the new site's menu. It matches the version you installed, and its
folder, `99-docpensieve`, can be deleted as soon as you no longer need it;
`--minimal` leaves it out. The configuration file lists every option, each with
a comment, set to its default or given as an example.

```bash
npx docpensieve init my-site --yes --name "My documentation"
```

| Option                     | Effect                                                  |
| -------------------------- | ------------------------------------------------------- |
| `-n, --name <name>`        | Project name, shown in the header                       |
| `-t, --theme <framework>`  | `tailwind` or `custom`                                  |
| `-u, --site-url <url>`     | Public URL, from which the deployment prefix is derived |
| `--version-name <version>` | First version, `1.0` for instance                       |
| `-y, --yes`                | Accepts the defaults without a dialogue                 |
| `-f, --force`              | Overwrites an existing configuration                    |
| `--minimal`                | Leaves DocPensieve's documentation out of the site      |

## In an existing project

```bash
npm install docpensieve
npx docpensieve init . --force
```

`init` on an occupied folder refuses to overwrite an existing configuration:
you have to ask for it with `--force`. The refusal is deliberate — a
configuration overwritten by mistake is only noticed at the next deployment.

## Choosing the theme

`tailwind` is the default and installs Tailwind as a dependency. `custom` does
without it entirely: the site is then styled by a stylesheet written in the
package, with no styling dependency.

Both are equivalent in use — the templates are the same, only the styling
changes. The choice is not final: it fits in one field of the configuration,
described in [Themes](./themes/).

## Checking

```bash
npx docpensieve build
```

If the output folder appears with an `index.html` inside, everything is in
place. Next: [First site](./first-site/).
