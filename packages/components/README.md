# @docpensieve/components

> Global MDX components

Part of [DocPensieve](https://github.com/Juniors017/docpensieve), a static documentation site generator:
Markdown and MDX in, static HTML out, one version per orphan branch, JSON-LD
structured data from the frontmatter.

## Installation

```bash
npm install @docpensieve/components
```

## Usage

The components registered here are injected into the MDX compilation: they
can be used in any page **without an import**.

```js
import { createRegistry } from '@docpensieve/components';

const components = createRegistry({ MyBlock });
```

React is a build-only dependency.

## Documentation

See the [repository](https://github.com/Juniors017/docpensieve#readme).

## License

MIT
