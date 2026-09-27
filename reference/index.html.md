# Reference

> Commands, configuration and frontmatter, field by field.

<Cards />

To learn how to use them rather than look them up, the [guide](/versions/latest/guide/) is the
right starting point.

## Errors

Every expected error carries a message and an **actionable hint**. An invalid
configuration, an unknown version slug, a value out of range: each one says
what is wrong and what is expected instead.

Nothing fails silently. A component that cannot render what it is asked for
stops the build rather than produce an inert element — a tag that does nothing
goes unnoticed on review, an error does not.

For the failures that say nothing — the site builds and something is still
wrong — the guide has [When it breaks](/versions/latest/guide/when-it-breaks/).
