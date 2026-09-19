---
title: Frontmatter
description: The fields recognised at the top of a page, and what they produce.
tags: [reference, frontmatter]

jsonld:
  type: TechArticle
  breadcrumbs: true
  faq:
    - question: Is the frontmatter mandatory?
      answer: No. Without a title, the project name stands in; without a date, no date is published.
    - question: How do I keep a page offline?
      answer: 'Set draft: true in its frontmatter. It stays in the repository, absent from the output.'
---

# Frontmatter

A YAML block at the top of the file, between two lines of three dashes.
Everything in it is optional.

```yaml
---
title: Installation
description: What you need, and how to set up a project.
date: 2026-09-09
modified: 2026-09-14
authors: [Valentin Chevoleau]
tags: [guide, installation]
preview: ./screenshot.png
draft: false
layout: doc

jsonld:
  type: TechArticle
  breadcrumbs: true
---
```

## The fields

| Field         | Effect                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| `title`       | `<title>` tag, menu entry, breadcrumb, JSON-LD `headline`                  |
| `description` | `description` metadata and JSON-LD `description`                           |
| `date`        | Publication date                                                           |
| `modified`    | Last modification date. Default: the publication date. Shown in the byline |
| `authors`     | Authors of the page, by name or by key of the version's author file        |
| `tags`        | Shown at the bottom of the page, and carried over as JSON-LD `keywords`    |
| `preview`     | Image of the page. The path is resolved like a link                        |
| `draft`       | `true` keeps the page out of the output                                    |
| `layout`      | `doc` (default) or `home`                                                  |
| `jsonld`      | Structured data settings                                                   |

## `layout`

`doc` is the documentation layout: menu on the left, table of contents on the
right, content held to reading width.

`home` removes all three. It is what a home page expects, where columns and
cards take the whole surface.

```yaml
layout: home
```

An unknown value stops the build. A typo would otherwise render the page in a
layout other than the intended one, without a word.

## `jsonld`

```yaml
jsonld:
  type: TechArticle
  breadcrumbs: true
  faq:
    - question: Do I need a frontmatter?
      answer: No, everything in it is optional.
```

| Field         | Effect                                        |
| ------------- | --------------------------------------------- |
| `type`        | `Article`, `TechArticle` or `BlogPosting`     |
| `breadcrumbs` | `false` removes the breadcrumb                |
| `faq`         | Questions and answers, published as `FAQPage` |

Every `faq` entry must carry `question` **and** `answer`: if one of them is
missing, the build stops and says so.

The questions must **also appear in the text of the page**. Search engines
reject markup that describes invisible content: a FAQ present only in the
frontmatter exposes the page to losing its structured data.

A `type` outside the list is refused the same way. This very page carries a
`faq`: its JSON-LD contains the block.

## What does not need to be written

The URL, the place in the menu, the breadcrumb and the `canonical` link are
derived from the file path and the configuration. Nothing to repeat in the
frontmatter, and nothing to keep up to date when a file is moved.

## Frequently asked questions

### Is the frontmatter mandatory?

No. Without a title, the project name stands in; without a date, no date is published.

### How do I keep a page offline?

Set `draft: true` in its frontmatter. It stays in the repository, absent from the output.

What these fields do once the page is built — the order of the menu, the
byline, the tags under the text — is in [Writing pages](../guide/writing-pages/).
