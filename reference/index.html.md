# Reference

> Commands, configuration and frontmatter, field by field.

- **[Commands](/versions/v0.2/reference/cli/)** — `init`, `build`, `check`, `dev`, `serve`
  and their options.
- **[Configuration](/versions/v0.2/reference/configuration/)** — every field of
  `docpensieve.config.mjs`, its default value and its effect.
- **[Frontmatter](/versions/v0.2/reference/frontmatter/)** — the fields recognised at the top
  of a page.
- **[Theme](/versions/v0.2/reference/theme/)** — slots, tokens and styling options.

To learn how to use them rather than look them up, the [guide](/versions/v0.2/guide/) is the
right starting point.

## Errors

Every expected error carries a message and an **actionable hint**. An invalid
configuration, an unknown version slug, a value out of range: each one says
what is wrong and what is expected instead.

Nothing fails silently. A component that cannot render what it is asked for
stops the build rather than produce an inert element — a tag that does nothing
goes unnoticed on review, an error does not.
