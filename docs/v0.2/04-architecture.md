---
title: Architecture
description: How a page becomes HTML, and why it works that way.
tags: [architecture]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Architecture

## The journey of a page

```
.md / .mdx file
      │
      ▼
  loading             frontmatter detached, slug derived from the path
      │
      ▼
  compilation         MDX → React component
      │
      ▼
  rendering           React → HTML string, once and for all
      │
      ▼
  shell               header, menu, table of contents, footer
      │
      ▼
  page written        a folder, an index.html
```

Once every page is written, and **only then**, the stylesheet is compiled: a
utility theme needs to know which classes were actually used.

## React does not leave the build

Components are rendered to HTML during the build. Content pages load no
runtime: what reaches the reader is markup and a stylesheet. The search page
alone adds a script, of a few kilobytes, to filter its list.

That explains the shape of the shipped components. None of them has state or
an event listener, because there would be nothing to bring them to life.
Whatever needs interaction goes through a native element — `details` for
expanding, a link for moving — or through CSS.

This constraint is also what guarantees that a page stays readable in ten
years: there is nothing that can stop working.

## Templates do not render content

A template engine builds the shell: header, menu, table of contents, version
switcher, footer. The content comes from the MDX compilation.

The two do not mix, and that is deliberate. The content is written by the
author and can contain anything; the shell is written once and must never
depend on what a page contains.

## The packages

```
shared        constants, errors, slugs — depends on nothing
core          configuration, loading, compilation, JSON-LD, generation
theme         stylings, each answering the same contract
components    components available in pages
cli           the commands
```

**The graph never goes up.** The engine imports neither the stylings nor the
components: the commands hand them over. That is what lets it be tested
without React or CSS, and what keeps a circular dependency from settling in
unnoticed.

## Theme slots

The templates contain no class. They ask the theme for the class of each slot,
and the theme answers — a simple class, or a handful of utilities.

Two practical consequences:

- changing styling requires touching no template;
- a styling only needs to redefine what it changes.

Components follow the same rule, with a fallback: when there is no answer, they
take a `dp-*` class that their own stylesheet styles from the theme tokens.
They therefore follow the active palette without knowing anything about it.

## URLs

A relative target resolves against the folder of the page's file. An absolute
target starts from the **version root**, not from the domain: a documentation
does not know it may be served under a sub-path.

That rewrite happens on the tree built from the Markdown — hence **before** the
components are rendered. A component that produces a URL must therefore resolve
it itself, following the same rules. That is why every rendered page is
announced to the components, just as the class table is announced to them.

## Nothing fails silently

It is the rule that runs through everything else. An unknown value, a missing
parent, a file not found: each one stops the build with a message and a hint.

The alternative — rendering an empty element, ignoring a prop, falling back on
a default value — produces pages that look right and are not. Those faults are
only discovered in production, long afterwards.
