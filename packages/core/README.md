<p align="center">
  <img src="https://raw.githubusercontent.com/Juniors017/docpensieve/main/branding/logo.jpg" alt="DocPensieve — Documentation &amp; Magical Memory" width="180">
</p>

# @docpensieve/core

> Generation engine

Part of [DocPensieve](https://github.com/Juniors017/docpensieve), a static documentation site generator:
Markdown and MDX in, static HTML out, one version per orphan branch, JSON-LD
structured data from the frontmatter.

## Installation

```bash
npm install @docpensieve/core
```

## Usage

Source loading, MDX compilation, structured data and site writing. The engine
depends neither on the theme nor on the components: they are **injected**,
which keeps it testable without React or CSS.

```js
import { loadConfig, DocLoader, Compiler, SiteGenerator } from '@docpensieve/core';

const config = await loadConfig();
const generator = new SiteGenerator(config, { theme, components });
await generator.buildAll();
```

`.md` and `.mdx` both go through MDX, then `react-dom/server`. React is a
**build-only** dependency: the produced HTML loads no runtime.

## Documentation

See the [repository](https://github.com/Juniors017/docpensieve#readme).

## License

MIT
