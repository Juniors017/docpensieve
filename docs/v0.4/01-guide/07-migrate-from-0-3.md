---
title: Migrate from 0.3 to 0.4
description: Move a project from the 0.3 to the 0.4 — what changes on its own, and what to turn on.
tags: [guide, migration]
---

# Migrate from 0.3 to 0.4

A project on the 0.3 builds with the 0.4 as it is: every field the 0.4 adds is
optional, and leaving them out keeps the site you have.

## Update

```bash
npm install docpensieve@latest
```

Through `npx` alone, `npx docpensieve` already runs it.

Read your site back once after the update — it is the cheapest check there is:

```bash
npx docpensieve build
npx docpensieve check
```

## What changes on its own

**On a narrow screen, the documentation menu now folds above the content**
instead of standing open between the header and the text. Nothing to
configure, and nothing to undo: on a wide screen the menu is unchanged.

Nothing else moves. Your pages, your configuration and your theme folder are
read exactly as before.

## What is worth turning on

Each of these is one line of `docpensieve.config.mjs`. None depends on
another.

### A menu that folds

Past twenty or so pages, a menu that shows everything asks the reader to scroll
past what does not concern them:

```js
foldedSidebar: true,
```

The categories fold, and the branch of the page being read opens on its own.
A category that is also a page keeps its page as the first entry — the handle
of a fold cannot be a link.

### Links in the header

```js
headerLinks: [
  { label: 'Blog', href: '/blog/' },
  { label: 'Repository', href: 'https://example.com/repo' },
],
```

A target starts from the root of a version, or is a full address. An entry
carrying `columns` opens a panel instead of leading anywhere; `href` and
`columns` together are refused, an entry doing one thing or the other.

See [Navigation](./navigation/) for the panel and for what happens on a phone.

### A header that scrolls away

```js
stickyHeader: false,
```

The header gives its height back to the text instead of holding to the top of
the screen. It stays held by default.

### Blocks that stand apart

Six kinds ship — `note`, `info`, `tip`, `attention`, `alert`, `danger` — and
need no configuration:

```mdx
<Admonition type="attention">Read this before upgrading.</Admonition>
```

Kinds of your own take a label and a tone:

```js
admonitions: {
  review: { label: 'To review', tone: 'attention' },
},
```

A kind nobody declared stops the build rather than rendering a block with no
colour and no label. See [Admonition](../components/admonition/).

### Icons from a set

Beside a file of your project, `LogoIcon` accepts the name of an icon from a
collection:

```bash
npm install --save-dev @iconify-json/simple-icons
```

```mdx
<LogoIcon src="simple-icons:github" label="Repository" />
```

The set is read at the build and the drawing placed in the page: no request
leaves your reader's browser. See [LogoIcon](../components/logo-icon/).

### A site in several languages

A version declares the folder of each translation, served under its code:

```js
translations: { fr: 'docs/v1.0-fr' },
```

The language of the site keeps its addresses, and a page nobody translated is
not offered in that language rather than served in another. See
[Languages](./languages/).

## What to check afterwards

- **Your own CSS**, if the theme folder styles the header or the menu: the
  folded menu adds `details` and `summary` elements where there were only
  links, and a static header no longer carries `position: sticky`.
- **A link to a heading**, if you turned the sticky header off: the space kept
  above an anchor goes away with it, which is the point.
- **`npx docpensieve check`**, which reads the built site back and reports dead
  links and invalid markup.

None of this is required. A project that turns none of it on is a 0.3 project
that happens to be running the 0.4.
