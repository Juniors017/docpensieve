# Guide

> From installation to deployment, in order.

These pages are read in order. Each one starts from what the previous one set
up.

<Cards />

## What to know first

The produced site is **entirely static**. Each page is a complete HTML file,
served as is, along with a single stylesheet. Nothing is computed on the
reader's side.

This has a consequence to keep in mind throughout: what depends on the moment —
a date, a countdown — is frozen at build time, not at reading time.
[TimeTimer](/versions/beta/components/time-timer/) says so explicitly, and a scheduled build
is enough to keep it right.
