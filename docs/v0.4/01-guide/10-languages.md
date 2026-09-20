---
title: Languages
description: Publish the same version in several languages — the folders, the addresses, and what happens to a page nobody translated.
tags: [guide, languages]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Languages

A version can be published in several languages. Each one is a folder of pages
of its own, standing beside the version it translates.

## Declaring a translation

```js
lang: 'en',
versions: [
  {
    slug: 'latest',
    name: '1.0',
    folder: 'docs/v1.0',
    current: true,
    translations: { fr: 'docs/v1.0-fr' },
  },
],
```

`lang` is the language of the site — the one your pages are written in. Every
entry of `translations` names a language and the folder holding that
translation.

```
docs/
├── v1.0/          the language of the site
│   ├── index.md
│   └── guide/
└── v1.0-fr/       its French translation
    ├── index.md
    └── guide/
```

## The addresses

The language of the site keeps the addresses it has; a translation is served
under its code:

| Page              | Address                              |
| ----------------- | ------------------------------------ |
| The site language | `/versions/latest/guide/install/`    |
| Its French twin   | `/versions/latest/fr/guide/install/` |

Nothing already published moves, which is the point: a link shared last year
still leads where it led. The translation lives **inside** the version, so a
version is still one folder, one orphan branch, one stylesheet.

## A page nobody translated

It does not exist in that language. It is absent from the menu of that
language and from the sitemap, no `hreflang` claims it, and the language
switcher names the language without offering it — a reader learns the site has
a French version, and is never handed English under a French address.

That is what lets a translation start with five pages. Translate what matters
first; the rest stays in the language it was written in until someone gets to
it.

## The words around your pages

The menu, the notices, the search field and the dates follow the language of
the page. English and French ship with the tool.

A language it does not ship keeps the English wording, and the `ui` field is
where a project writes its own — or corrects a word:

```js
lang: 'de',
ui: {
  de: { search: 'Suchen', onThisPage: 'Auf dieser Seite' },
},
```

Anything left out stays in English rather than empty: half a translation is
still a readable page. A key that does not exist stops the build, listing those
that do — a typo there would leave the shipped word in place without a word.

### Counting, in the plurals of the language

One key is not a word but a set of them: `pages`, which follows a number.

```js
ui: {
  pl: { pages: { one: 'strona', few: 'strony', many: 'stron', other: 'stron' } },
},
```

The categories are those of **CLDR**, the reference the browsers and Node
carry: English has two — `one` and `other` — French puts zero in the singular,
Polish has four and Arabic six. The build picks the right one through
`Intl.PluralRules` rather than comparing the count with one, which is an
English rule.

Fill `other` at least: it is the category every language has, and it answers
for the ones a translation leaves out.

## What the language decides by itself

Three things follow from the code alone, with nothing to declare:

| From the language    | What it sets                                         |
| -------------------- | ---------------------------------------------------- |
| Writing direction    | `dir="rtl"` on `<html>` for Arabic, Hebrew, Persian… |
| Plural of a count    | The CLDR categories above                            |
| The date of a byline | Written in the conventions of that language          |

The codes themselves are **BCP 47** tags — `fr`, `pt-BR`, `zh-Hans` — the
standard `<html lang>` and `hreflang` expect. A tag that is not one stops the
build: it would otherwise put in the markup a value no browser or screen reader
knows how to read.

Search engines also receive `hreflang="x-default"`, pointing at the language
the pages are written in: it is the address to serve a reader whose own
language the site does not have.

## What each language has of its own

| Its own                              | Shared with the version           |
| ------------------------------------ | --------------------------------- |
| Pages, menu, search page             | The stylesheet                    |
| Author file and images of its folder | The logo and favicon              |
| The wording of the shell             | The version notice and its number |

The author file is read in each folder, so a biography can be translated with
the pages it signs.

## What to check

- **A translation folder named but missing** stops the build, naming the
  language rather than the folder alone.
- **`check` after a translation lands**: a page added on one side and linked
  from the other is the usual first dead link.
- Use the same page paths on both sides. A page translated under a different
  file name is a different page: it has no twin, and the switcher says so.
