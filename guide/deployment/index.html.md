# Deployment

> Publish the site, and keep past versions online.

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

## One command, for you and for the machine

Two commands are one too many to remember, and a workflow should run exactly
what you run. A `package.json` is the place to say it once:

```json
{
  "scripts": {
    "docs": "docpensieve dev",
    "check": "docpensieve build && docpensieve check"
  }
}
```

`npm run check` then generates the site and reads it back. A dead link, a
nesting the markup cannot carry, a page that stops the build: each one fails
the command, on your machine and in your workflow, in the same way and with
the same message.

The `&&` is the point of it. `check` reads what `build` wrote, so a check run
on its own tells you about the site as it was the last time it was generated —
which, the day you forget, is the day it matters.

With that in place the recipe above becomes `npm ci` and `npm run check`, and
the version of the tool stops depending on the day the workflow ran.

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
with its history. See [Versions](/versions/beta/guide/versions/).

## Search engines and feed readers

With `siteUrl` set, the build writes `sitemap.xml` at the root of the site —
every published version, a version in preparation excepted. Give its address
to the search engines you care about; `robots.txt` names it for them when the
site sits at the root of its domain.

For pages that are news rather than reference — release notes, a changelog —
give them a `date` and set `feed: true`: `feed.xml` then lists them, newest
first. The fields are in the [configuration reference](/versions/beta/reference/configuration/).

For programs that read documentation on someone's behalf, `llms: true` writes
`llms.txt` at the root and a Markdown copy beside each page — the text
without the markup. It needs no `siteUrl`.

## What the reader downloads

The build keeps it light on its own. The stylesheet is minified — a third to
half lighter. Every image of a page gets its width and height, read from its
file, so that the text does not jump when it arrives, and all but the first
load lazily, when the reader nears them. There is nothing to configure.

## A Content-Security-Policy

A Content-Security-Policy tells the browser what a page may load and run, so
that a script slipped into it is refused. A host that lets you set response
headers can send one with the site, and the pages hold up under a strict one —
one line in the header, split here to be read:

```text
default-src 'self';
script-src 'self' 'sha256-9V5TjnZ1QZI4gqywFKZk0OWiHyt6/BX2XWMibvI5UKc=' 'sha256-uoMvfl2Wu3fqzsh38hLYURHzlNXf65BbRUVEBM5sots=';
style-src 'self'; style-src-attr 'unsafe-inline';
object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

- **The two hashes** are the two scripts written into the page by the light /
  dark button: one applies the reader's choice before the first paint, the
  other runs the button. Their words come from the button itself, in the
  language of the page, so the scripts are the same text on every page of
  every site: the hashes do not change with your content. They change with the
  tool — after an update, a refused script names in the browser console the
  hash it expected. `theme.toggle: false` removes both scripts, and the hashes
  with them.
- **Every other script is a file of the site** — the client file of the
  version, the search script and its index — which `'self'` covers.
- **`style-src-attr 'unsafe-inline'`** is the one allowance. The code
  highlighter colours each word with a `style` attribute, and some components
  size themselves that way. It lets style attributes through, not `<style>`
  elements, and a style attribute runs no code.

This policy was checked in a browser against the pages of this site: search,
copy buttons, calendars and the light / dark button all work, and nothing is
refused. If your pages load anything from another address — an image, a font —
add that address to the matching directive.
