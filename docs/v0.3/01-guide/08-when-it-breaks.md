---
title: When it breaks
description: The failures this tool actually produces, what causes each one, and the fix — by the symptom you see.
tags: [guide, troubleshooting]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# When it breaks

Every expected error carries a message **and a hint** saying what is expected
instead, and the command exits with code 1 without a stack trace. The failures
below are the ones that say nothing, or say it somewhere you were not looking:
the site builds, the suite is green, and something is still wrong.

Each heading is the symptom as you would describe it.

## `init` asked me nothing and built a site I did not choose

The dialogue needs a real terminal. Run from a script, a pipeline or through a
pipe, `init` takes the options given on the command line and the defaults for
everything else — it announces this before starting, unless `--yes` says you
meant it.

Pass what matters explicitly:

```bash
npx docpensieve init my-site --name "Acme docs" --theme custom --site-url https://acme.example.com
```

## `npx` runs a version older than the one I just published

A freshly published version takes a few minutes to reach every mirror of the
registry, and `npx` keeps what it already has. During those minutes,
installing can even fail outright with `ETARGET`, because the packages pin each
other to the exact same version and one of the five is not there yet.

```bash
npx --prefer-online docpensieve@latest init my-site
```

Wait rather than republish: a version number burned is not recoverable, and
nothing is wrong with the one being propagated.

## The site works on my machine and every link is dead online

The site is served from a subfolder and `baseUrl` was not set. Locally,
`serve` and `dev` answer at the root, so nothing shows.

```js
siteUrl: 'https://acme.example.com/docs',
baseUrl: '/docs/',
```

`baseUrl` prefixes every internal link. Without it, a link written
`/guide/installation/` points one level above the site.

## `check` says a link "ignores the deployment prefix"

The file exists, but the link was written without the prefix — it will lead
nowhere once online, and hitting it locally hides that.

```
  index.html
    /guide/installation/
    → ignores the deployment prefix "/docs/"
```

Write the link the way the documentation does — relative to the page
(`../components/card/`) or from the root of the version (`/components/card/`,
which the build rewrites) — rather than typing the deployed path by hand.

## My page does not appear anywhere

Three causes, in the order worth checking:

- **`draft: true`** in its frontmatter keeps it out of the output, on purpose.
- **The file is outside a version folder.** Only what lives under a `folder`
  declared in `versions` is read.
- **The extension.** `.md` and `.mdx` are read; nothing else is.

The build says nothing in these three cases, because none of them is an error:
a folder you did not declare is simply not documentation.

## A colour I set in `tokens` changes nothing

`theme.tokens` sets the **light** palette. A site carrying
`theme.darkMode: 'dark'` is always dark, so it never shows those values — the
dark ones come from the theme's stylesheet.

Redefine them in the `theme/` folder, for both ways of being dark:

```css
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --dp-accent: #a78bfa;
  }
}

:root.dark {
  --dp-accent: #a78bfa;
}
```

## Node warns at every build, or refuses the configuration

A `.js` configuration file is read as a module only when the nearest
`package.json` says `"type": "module"` — and the one `npm init -y` writes says
the opposite, which makes Node refuse the file outright.

Name it `docpensieve.config.mjs`. The extension settles it whatever the
`package.json` says.

The build also stops when **both** files are present:

```
Two configuration files in /path/to/project: docpensieve.config.mjs and docpensieve.config.js.
```

Keep one. Guessing which you meant would sooner or later publish a site built
from the wrong settings.

## A component stops the build, or renders nothing

A component that needs a parent checks for it: a `Column` written outside a
`Columns` stops the build rather than render a flex item with no row around it
— full width, no error, unnoticed on review.

`globalComponents: false` removes the shipped components from every page. A
page still using one then stops the build, naming it:

```
Error Unknown component "Cards" in docs/v1.0/99-docpensieve/01-guide/index.mdx.
No global component is registered for this compilation.
```

Either turn them back on, or remove the installed documentation with the
components it uses — `--minimal` at `init` leaves it out from the start.

A `.md` page using a component works, but its extension no longer says what the
page does. Rename it `.mdx`; the two compile identically.

## A utility class in a page has no effect

Under the `tailwind` theme, the stylesheet is compiled from the classes found
in the **rendered** pages. A class whose name does not survive being written
into HTML is never emitted, and nothing reports it — an `&` becomes `&amp;`,
so `[&_.x]:underline` produces no rule.

Pass through a variable of the component instead:

```mdx
<Skill name="Coverage" level={97} color="#10b981" />
```

## Nothing above matches

Run the two commands that look at different things, in this order:

```bash
npx docpensieve build
npx docpensieve check
```

The build compiles pages and stops on what it cannot do. `check` reads the
produced site back and follows its links — a renamed page compiles perfectly
and leaves every link to it dead.

An unexpected failure — one without a hint — comes out with its stack trace,
and is worth reporting with the version printed by `npx docpensieve --version`.

Each message comes from a command, and the [CLI reference](../reference/cli/)
lists what each one does, with the exit codes a pipeline reads.
