<p align="center">
  <img src="https://raw.githubusercontent.com/Juniors017/docpensieve/main/branding/logo.jpg" alt="DocPensieve — Documentation &amp; Magical Memory" width="180">
</p>

# @docpensieve/theme

> Composable themes

Part of [DocPensieve](https://github.com/Juniors017/docpensieve), a static documentation site generator:
Markdown and MDX in, static HTML out, one version per orphan branch, JSON-LD
structured data from the frontmatter.

## Installation

```bash
npm install @docpensieve/theme
```

## Usage

Two themes ship — Tailwind and a dependency-free custom theme — behind the
same contract. Templates ask the theme for their classes rather than
hard-coding them, which gives two renderings for a single set of templates.

```js
import { ThemeEngine, CustomProvider } from '@docpensieve/theme';

const engine = new ThemeEngine().register(
  'custom',
  new CustomProvider({ tokens: { '--dp-accent': '#008060' } }),
);
```

Writing your own takes two members:

```ts
import { BaseThemeProvider } from '@docpensieve/theme';
import type { ThemeOutput, CompileContext } from '@docpensieve/theme';

class MyProvider extends BaseThemeProvider {
  get classes() {
    return { nav: 'my-nav' };
  }
  async compile(context?: CompileContext): Promise<ThemeOutput> {
    return { css: '.my-nav{}', variables: {} };
  }
}
```

`tailwindcss` is installed with the package: the default theme needs it, and
starting a project should not ask for anything more. The custom theme does not
use it.

## Documentation

See the [repository](https://github.com/Juniors017/docpensieve#readme).

## License

MIT
