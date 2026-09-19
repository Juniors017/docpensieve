---
title: What's new in 0.4
description: What the 0.4 brings, and what it changes for a 0.3 project.
tags: [release]
---

# What's new in 0.4

This version is **in preparation**. Its betas go out under the npm tag `beta`,
while the version installed by default stays the 0.3, documented in the
`latest` pages of this site:

```bash
npx docpensieve@beta init my-site
```

Each feature is announced here as it lands, with a link to the guide and to the
reference: this page announces, it is never the only place something is
written.

## Already there

The 0.4 turns on the navigation. A site of forty pages was asking its reader to
scroll past what did not concern them; it can now fold its menu, carry its own
links in the header, and set a passage apart in the middle of a page.

### A menu that folds

`foldedSidebar: true` folds the categories of the documentation menu, and opens
the branch the reader stands in. On a narrow screen the whole menu folds above
the content, whatever that setting — nothing to configure for that one. See
[Navigation](./guide/navigation/).

### Links and panels in the header

A `headerLinks` entry adds a link beside the version switcher. An entry
carrying `columns` opens a **panel** of links instead of leading anywhere, so a
site can navigate from the header alone, from the menu alone, or from both with
different links. A `version` field points every version at a single one, which
is how this site leads to its examples. See
[Navigation](./guide/navigation/) and
[the configuration reference](./reference/configuration/).

### A header held, or not

`stickyHeader` decides whether the header holds to the top of the screen or
scrolls away with the page, giving its height back to the text. It stays held
by default. See [Navigation](./guide/navigation/).

### A menu of links, anywhere in a page

The `Menu` component places a row of links where a page needs them — a summary
at the top of a landing page, the chapters of a guide. Entries can be grouped
under a title, and the row folds behind a button on a narrow screen, without a
script. See [Menu](./components/menu/).

### Blocks that stand apart

`Admonition` sets a passage apart and says how to read it: `note`, `info`,
`tip`, `attention`, `alert`, `danger`. A project declares **its own kinds** in
the `admonitions` field — a label and a tone taken from the theme — so the list
does not have to grow for a team to have the block it needs. See
[Admonition](./components/admonition/).

### Icons from a set

`LogoIcon` accepts the name of an icon from a collection, written
`simple-icons:github`, beside a file of your project. The set is a package your
project installs and the drawing is placed in the page at the build, like any
other icon: your reader downloads nothing, and no request leaves their browser.
An admonition kind takes its mark the same way. See
[LogoIcon](./components/logo-icon/).

### A site in several languages

A version declares the folder of each translation:

```js
versions: [
  { slug: 'latest', name: '1.0', folder: 'docs/v1.0', current: true,
    translations: { fr: 'docs/v1.0-fr' } },
],
```

The language of the site keeps the addresses it has, and a translation is
served under its code — `/versions/latest/fr/`. The shell follows: English and
French ship with the tool, and the `ui` field corrects a word or adds a
language. A page nobody translated is not offered in that language rather than
served in another. See [Languages](./guide/languages/).

## For a 0.3 project

Nothing to change: a 0.3 configuration builds as it is, every new field being
optional. [Migrate from latest to beta](./guide/migrate-to-beta/) lists what
changes on its own, and what is worth turning on.
