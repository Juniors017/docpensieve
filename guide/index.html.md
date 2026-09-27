# Guide

> From installation to deployment, in order.

These pages are read in order. Each one starts from what the previous one set
up.

1. **[Installation](/versions/v0.2/guide/installation/)** — what you need, and how to set up
   a project.
2. **[First site](/versions/v0.2/guide/first-site/)** — build, serve, look at what was
   produced.
3. **[Writing pages](/versions/v0.2/guide/writing-pages/)** — frontmatter, URLs, menu, links,
   images.
4. **[Versions](/versions/v0.2/guide/versions/)** — several documentation versions, one
   branch each.
5. **[Themes](/versions/v0.2/guide/themes/)** — style the site, change the classes without
   touching the HTML.
6. **[Deployment](/versions/v0.2/guide/deployment/)** — publish, and keep past versions
   online.
7. **[Migrate from 0.1 to 0.2](/versions/v0.2/guide/migrate-from-0-1/)** — move a 0.1 project to
   the 0.2.

## What to know first

The produced site is **entirely static**. Each page is a complete HTML file,
served as is, along with a single stylesheet. Nothing is computed on the
reader's side.

This has a consequence to keep in mind throughout: what depends on the moment —
a date, a countdown — is frozen at build time, not at reading time.
[TimeTimer](/versions/v0.2/components/time-timer/) says so explicitly, and a scheduled build
is enough to keep it right.
