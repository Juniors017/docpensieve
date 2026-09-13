---
title: Components
description: The components available in every page, without an import.
---

# Components

These components can be used in any `.mdx` page **without an import**.

They provide the **structure** — wrappers, separators, spacing. The look is set
with `className`, in utilities of the active theme:

```mdx
<Card className="max-w-sm">
  <CardHeader className="text-center font-bold">Title</CardHeader>
</Card>
```

The component classes live in the `components` layer, below the utilities: a
`className` set at use always wins.

## Available

- [Card](/components/card/) — card, with header, body, footer and image
- [Columns](/components/columns/) — column grid
- [TimeTimer](/components/time-timer/) — display depending on a date
- [Tooltip](/components/tooltip/) — tooltip on hover and from the keyboard
- [Tree](/components/tree/) — collapsible tree
- [ScrollToTop](/components/scroll-to-top/) — back to the top of the page
- [Skill](/components/skill/) — level gauge
- [LogoIcon](/components/logo-icon/) — SVG icon inlined in the page

## Without JavaScript

The produced site loads no script. Whatever needs interaction therefore goes
through native elements or through CSS: `details` for expanding, a link for
moving, `animation-timeline` for appearing on scroll.

When the browser does not know one of these properties yet, the component stays
usable in its simplest state — visible, full, expanded. None of them waits for
a capability to work.
