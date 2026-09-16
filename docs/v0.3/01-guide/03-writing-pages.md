---
title: Writing pages
description: Frontmatter, URLs, menu order, links and images.
tags: [guide, content]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Writing pages

A page is a `.md` or `.mdx` file in the version folder. Both go through the
same chain: the extension does not change what is possible, it only states the
intent.

## The frontmatter

```yaml
---
title: Installation
description: What you need, and how to set up a project.
date: 2026-09-09
tags: [guide, installation]
---
```

`title` becomes the `<title>` tag, the menu entry and the breadcrumb.
`description` feeds the metadata and the JSON-LD. Everything is optional:
without `title`, the project name stands in.

The fields are detailed in the [reference](../reference/frontmatter/).

## What the URL depends on

The file path gives the URL path, stripped of its extension and of its sorting
prefix:

| File                        | URL                    |
| --------------------------- | ---------------------- |
| `index.md`                  | `/`                    |
| `guide/01-installation.md`  | `/guide/installation/` |
| `guide/index.md`            | `/guide/`              |
| `components/02-columns.mdx` | `/components/columns/` |

The `01-` prefix **orders the menu without appearing in the URL**. It is the
only way to sort pages other than alphabetically, and it saves keeping a
separate list.

## The menu order

The menu is derived from the file tree. Folders become sections, numeric
prefixes give the order, and an `index.md` in a folder provides the title of
the section.

```
docs/v1.0/
├── index.mdx           →  /
├── guide/
│   ├── index.md        →  /guide/        (title of the section)
│   ├── 01-installation.md
│   └── 02-first-site.md
└── components/
    ├── index.md
    └── 01-card.mdx
```

## Writing the menu by hand

When the file tree does not give the menu you want, describe it in a JSON file
of the version's folder, and name it in the configuration:

```js
// docpensieve.config.mjs
sidebar: 'sidebar.json',
```

```json
[
  "/",
  { "label": "Start here", "items": ["guide/installation", "guide/first-site"] },
  { "auto": "components" },
  { "label": "Repository", "href": "https://github.com/me/my-project" }
]
```

A page is named by its path, as in its URL. `{ "auto": "components" }` keeps
the automatic menu of a folder — the DocPensieve section stays whole that way.
A page the file leaves out is still published, only off the menu. Every kind
of entry is in the [`sidebar` reference](../reference/configuration/).

## Internal links

Two spellings, two meanings:

- **relative** — `./sibling/`, `../guide/` — resolves against the folder of the
  page's file, as between any two files;
- **absolute** — `/guide/installation/` — starts from the **version root**, not
  from the domain root.

The second rule deserves a pause. A documentation does not know it may be
served under `/my-project/versions/v1.0/`: if `/guide/installation/` were taken
literally, every internal link would break as soon as a prefix comes into play.
They are therefore rewritten at build time.

To target a real domain URL, the full address remains.

## Images

An image sits next to the page and is written relatively:

```md
![Pipeline diagram](./diagram.png)
```

Files that are not pages are copied as is into the output, at the same
relative place. The path is rewritten like a link.

The build reads the width and height of each image from its file — PNG, JPEG,
GIF, WebP or SVG — and writes them on the page: the browser keeps the room
before the image arrives, instead of shifting the text when it does. Every
image but the first loads lazily, when the reader nears it; the first, often in
view, keeps its normal loading.

## Components

In an `.mdx` page, the shipped components are used **without an import**:

```mdx
<Columns>
  <Column span={8}>The bulk of the point</Column>
  <Column span={4}>A side remark</Column>
</Columns>
```

They are rendered at build time: the delivered HTML only holds their result.
The list is in [Components](../components/).

## A trap to know

The content of a JSX tag **left alone on its own line** becomes a paragraph:

```mdx
<p className="flex gap-3">Some text</p>
```

produces `<p class="flex gap-3"><p>Some text</p></p>` — two nested paragraphs,
which is invalid. The browser closes the first one by itself: the wrapper
disappears, and the intended layout with it.

The formatter makes the trap sneaky. A long string of classes ends up broken
over several lines, which leaves the text alone on its line **after the fact**,
without anyone having written it that way.

Three ways to guard against it:

- prefer `<div>` to `<p>` as a wrapper — a paragraph is valid inside it;
- write short content on the same line as its tags;
- for repeated cases, put a class in the `theme/` folder rather than a long
  string of utilities, so that the line stays short.

`docpensieve check` reports these nestings on the produced site.

## What is not published

A page whose frontmatter carries `draft: true` is loaded but kept out of the
output. That is what lets a work-in-progress page stay in the repository
without being published.
