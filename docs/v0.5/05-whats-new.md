---
title: What's new in 0.5
description: What the 0.5 brings, and what it changes for a 0.4 project.
tags: [release]
---

# What's new in 0.5

This version is **in preparation**. Its betas go out under the npm tag `beta`,
while the version installed by default stays the 0.4, documented in the
`latest` pages of this site:

```bash
npx docpensieve@beta init my-site
```

Each feature is announced here as it lands, with a link to the guide and to the
reference: this page announces, it is never the only place something is
written.

## Already there

### A button that copies a block of code

`copyCode: true` puts a copy button on every block of code. It is the first
thing a DocPensieve page asks a reader to load, so it is off until you ask for
it — and then the behaviour is written once per version, shared by every page
and every language, and loaded only by the pages that hold code. About two
kilobytes, compressed; no framework, no hydration.

This is the rule of no script at all giving way to one that can be measured:
a page loads only what it uses. [The field](./reference/configuration/)

### A code block that names a file

`Snippet` shows a real file of your project, read when the page is generated.
An example written by hand is a copy, and a copy stops being true the day the
code changes, with nothing to report it. A range of lines or a `#region`
marker keeps part of the file; `collapsed` folds a long one into a `details`,
still without a script.

```mdx
<Snippet source="src/index.js" region="guard" />
```

The idea comes from Christophe Avonture.

[The component](./components/snippet/)

### init asks about languages

`init` now asks whether the site will be in several languages, and sets the
answer up: the folder beside your pages, `translations` written out in the
configuration, and a home page in that language to start from. The second
sample page is deliberately left untranslated, so that the menu shows what an
untranslated page does — nothing, in that language.

```bash
npx docpensieve init my-site --translation fr
```

A code is a BCP 47 one: `fr`, `pt-BR`, `zh-Hans`. French and English ship with
their wording for the shell; any other language keeps the English wording
until the `ui` field gives it its own.

[Languages](./guide/languages/) · [The init options](./reference/cli/)

## For a 0.4 project

Nothing to change: a 0.4 configuration builds as it is, and a site already in
two languages is untouched — the question only shapes a **new** project.
[Migrate from latest to beta](./guide/migrate-to-beta/) lists what changes on
its own, and what is worth turning on.
