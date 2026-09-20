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
skips them and accepts the defaults. Where it cannot ask — a script, continuous
integration, or a terminal that gives the programs it runs no interactive
input — it says so and sticks to the options and the defaults.

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

## Installing it in a project

Through `npx` alone, the version used is the latest. To pin the one a project
uses — what continuous integration needs — install it in the project:

```bash
npm init -y              # only when the folder has no package.json yet
npm install docpensieve
npx docpensieve init .
```

`npm install` only installs: it creates no site and asks nothing — `init` does.
It also installs in the nearest folder that has a `package.json`, going up from
the current one: in a folder without one, the package lands in a parent folder
and nothing appears where you are. Hence `npm init -y` first. `npx docpensieve`
then runs the installed copy.

`init` refuses to overwrite an existing configuration: you have to ask for it
with `--force`. The refusal is deliberate — a
configuration overwritten by mistake is only noticed at the next deployment.

## Choosing the theme

`tailwind` is the default and installs Tailwind as a dependency. `custom` does
without it entirely: the site is then styled by a stylesheet written in the
package, with no styling dependency. Your own classes then go in the `theme/`
folder, which `init` starts with `theme/custom.css`.

Both are equivalent in use — the templates are the same, only the styling
changes. The choice is not final: it fits in one field of the configuration,
described in [Themes](./themes/).

## Updating

```bash
npm install docpensieve@latest
```

Run through `npx` alone, DocPensieve needs nothing: `npx docpensieve` fetches
the latest version by itself.

A project set up with 0.1.0 has a `docpensieve.config.js`. It still works, but
Node reads it as a module only when the `package.json` says so, and warns on
every build otherwise: rename it `docpensieve.config.mjs`.

The documentation `init` installed in `99-docpensieve` stays at the version it
came with. To refresh it, run `init` in a scratch folder and copy that folder
over.

Coming from the 0.4, [Migrate from latest to beta](./migrate-to-beta/) says
what changes on its own and what to check first. To try this beta, install
`docpensieve@beta`, or run `npx docpensieve@beta` alone.

## Checking

```bash
npx docpensieve build
```

If the output folder appears with an `index.html` inside, everything is in
place. Next: [First site](./first-site/).
