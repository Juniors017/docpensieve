# @docpensieve/shared

> Shared constants, errors and slugs

Part of [DocPensieve](https://github.com/Juniors017/docpensieve), a static documentation site generator:
Markdown and MDX in, static HTML out, one version per orphan branch, JSON-LD
structured data from the frontmatter.

## Installation

```bash
npm install @docpensieve/shared
```

## Usage

This package depends on nothing: it is the leaf of DocPensieve's dependency
graph. Anything two or more packages need lives here.

```js
import { slugify, filePathToSlug, DocPensieveError } from '@docpensieve/shared';

slugify('Crème Brûlée Recipes'); // 'creme-brulee-recipes'
filePathToSlug('guide/01-install.md'); // 'guide/install'
```

Accents are stripped from slugs, which keeps URLs readable instead of
percent-encoded.

## Documentation

See the [repository](https://github.com/Juniors017/docpensieve#readme).

## License

MIT
