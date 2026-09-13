---
title: Themes
description: Style the site, and change the classes without touching the HTML.
tags: [guide, theme]

jsonld:
  type: TechArticle
  breadcrumbs: true
---

# Themes

## Two stylings

```js
theme: {
  framework: 'tailwind',
  darkMode: 'class',
},
```

`tailwind` compiles on demand only the classes actually used in the produced
pages. `custom` does without it entirely: a stylesheet written in the package
styles the site, with no styling dependency.

The templates are the same in both cases. Switching values requires touching
no page.

## The principle: slots, not classes

The templates **hard-code no class**. They ask the theme for the class of each
slot — the header, the menu, a navigation link — and the theme answers.

The twenty-four slots are listed in the [reference](../reference/theme/).

That is what lets a utility styling and a classic styling share the same HTML:
one answers `dp-nav-link`, the other a handful of utilities. The template
itself does not change.

Components follow the same rule. When the theme does not answer, they fall
back on a `dp-*` class that their stylesheet styles from the `--dp-*` tokens:
they therefore follow the active palette without knowing anything about it.

## Changing the colours

The fifteen tokens are listed in the [reference](../reference/theme/). They are
redefined from the configuration:

```js
theme: {
  framework: 'tailwind',
  tokens: {
    '--dp-accent': 'oklch(55% 0.2 250)',
    '--dp-radius': '0.75rem',
  },
},
```

| Token                                  | What it sets                                                   |
| -------------------------------------- | -------------------------------------------------------------- |
| `--dp-bg`, `--dp-bg-soft`              | Backgrounds                                                    |
| `--dp-text`, `--dp-text-soft`          | Text                                                           |
| `--dp-border`, `--dp-rule`             | Borders and rules                                              |
| `--dp-accent`, `--dp-accent-soft`      | Accent colour                                                  |
| `--dp-radius`                          | Corner rounding                                                |
| `--dp-font`, `--dp-font-mono`          | Font families                                                  |
| `--dp-content-width`                   | Reading width. `none` by default: the content fills its column |
| `--dp-sidebar-width`, `--dp-toc-width` | Side columns                                                   |

A redefined token propagates everywhere: components included, without any of
them having to know.

## Adding CSS

```js
theme: {
  framework: 'tailwind',
  css: '.dp-article h2 { letter-spacing: -0.01em; }',
},
```

The content of `css` is appended to the produced stylesheet.

## Layer order

Under the `tailwind` theme, the stylesheet declares its layers in this order:

```css
@layer theme, base, components, utilities;
```

Component rules live in `components`, **below** the utilities. A `className`
set at use therefore always wins, whatever the place of the rule in the file:

```mdx
<Card className="border-0 shadow-none">…</Card>
```

Without this layer, a component rule written after a utility would beat it at
equal specificity, and the author's `className` would be ignored without a
word.

The `custom` theme has no utilities: a `className` there designates your own
classes. Declare them in `theme.css` — outside any layer, they come before the
component rules.

## The stylesheet is compiled last

A utility theme only emits the rules of the classes actually used: it
therefore needs the rendered pages before it can compile. The build first
writes every page, collecting the classes along the way, then compiles the
stylesheet.

That is also why the slot classes are available **without** waiting for that
compilation: the templates need them to be rendered. The two things are kept
apart for this reason alone.
