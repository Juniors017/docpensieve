---
title: Commands
description: init, build, check, dev and serve, with their arguments and options.
tags: [reference, cli]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Commands

```bash
npx docpensieve <command> [arguments] [options]
```

## `init`

Sets up a documentation project.

```bash
npx docpensieve init [dir]
```

| Option                     | Effect                                  |
| -------------------------- | --------------------------------------- |
| `[dir]`                    | Target folder. Default: `.`             |
| `-n, --name <name>`        | Project name                            |
| `-t, --theme <framework>`  | `tailwind` or `custom`                  |
| `-u, --site-url <url>`     | Public URL of the site                  |
| `--version-name <version>` | First version, `1.0` for instance       |
| `--translation <code>`     | Code of a second language, `fr`         |
| `-y, --yes`                | Accepts the defaults without a dialogue |
| `-f, --force`              | Overwrites an existing configuration    |
| `--minimal`                | Leaves DocPensieve's documentation out  |

Without `--force`, the command refuses to overwrite an existing configuration.

Without an interactive terminal — a script, continuous integration, or a
terminal that gives the programs it runs no interactive input — the command
asks nothing: it says so, then sticks to the options and the defaults. `--yes`
makes that choice explicit and silences the notice.

Unless `--minimal` is given, the command installs DocPensieve's documentation
in the new site, in `docs/<version>/99-docpensieve/`: a **DocPensieve** section
at the end of the menu, matching the installed version. Delete that folder when
you no longer need it.

Under the `custom` theme, the command also writes `theme/custom.css`, where the
project's own classes go, and — with the documentation —
`theme/99-docpensieve.css`, the classes of its examples, to delete along with
it. An existing `theme/custom.css` is never overwritten, even with `--force`.

## `build`

Generates the site.

```bash
npx docpensieve build [version]
```

| Option            | Effect                                               |
| ----------------- | ---------------------------------------------------- |
| `[version]`       | Version slug. When omitted, every version is built   |
| `-o, --out <dir>` | Output folder. Default: the one in the configuration |

With a slug, only that version is written, in `versions/<slug>/`. That form
writes **neither the manifest nor the root redirect**: after adding or
removing a version, run a full build.

## `check`

Reads the produced site back: internal links and markup.

```bash
npx docpensieve check
```

| Option            | Effect                                                 |
| ----------------- | ------------------------------------------------------ |
| `-d, --dir <dir>` | Folder to check. Default: the one in the configuration |

### Links

- a target that **ignores the deployment prefix** — the file exists, but the
  link will lead nowhere once online. It is the symptom of a URL that escaped
  resolution;
- a target that **matches no produced file**.

External targets, anchors and `mailto:` are left alone. A target that comes
back several times in a page is reported only once.

### Markup

- a **paragraph nested** in another one;
- a **paragraph inside an element that only accepts text**, a `span` for
  instance;
- a **block element inside a paragraph**, a heading for instance.

They usually come from the same source, described in
[Writing pages](../guide/writing-pages/): the content of a JSX tag left alone on
its line becomes a paragraph. The browser then silently undoes the nesting, the
wrapper disappears, and the intended layout with it.

If anything is left to fix, the command exits with code 1: it therefore fails a
continuous integration run without any particular setting.

## `dev`

Development server, which rebuilds on every save.

```bash
npx docpensieve dev
```

| Option                | Effect                          |
| --------------------- | ------------------------------- |
| `-p, --port <number>` | Listening port. Default: `3000` |

## `serve`

Serves the output folder statically, without rebuilding anything.

```bash
npx docpensieve serve
```

| Option                | Effect                          |
| --------------------- | ------------------------------- |
| `-p, --port <number>` | Listening port. Default: `4000` |
| `-d, --dir <dir>`     | Folder to serve                 |

It is the command that faithfully reproduces what a host will do: to check what
will be published, chain `build` then `serve`.

## Exit codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| `0`  | Everything went well                                           |
| `1`  | Expected error — message and hint shown, without a stack trace |
| `2`  | Feature not written yet                                        |

An unexpected error comes out with its full stack trace: it is a defect of the
generator, not of the documentation it is given.
