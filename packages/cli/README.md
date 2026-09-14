# docpensieve

> Command-line interface

Part of [DocPensieve](https://github.com/Juniors017/docpensieve), a static documentation site generator:
Markdown and MDX in, static HTML out, one version per orphan branch, JSON-LD
structured data from the frontmatter.

## Installation

```bash
npm install docpensieve
```

## Usage

```bash
npx docpensieve init          # sets up a project and picks the theme
npx docpensieve dev           # builds, serves, watches and reloads
npx docpensieve build [ver]   # builds every version, or a single one
npx docpensieve check         # reads the produced site back: links, markup
npx docpensieve serve         # serves the output folder
```

`init` asks for the project name, its URL and the CSS framework, and installs
DocPensieve's documentation in a section of the new site's menu, matching the
installed version — `--minimal` leaves it out. The configuration file it writes
lists every option, each with a comment. In a script or in CI,
`--yes --theme tailwind` skips the dialogue.

The development server reloads the browser after every rebuild, through a
script injected **at serving time**: the output of `build` stays free of
JavaScript.

## Updating

```bash
npm install docpensieve@latest
```

Run through `npx` alone, it needs nothing: `npx docpensieve` fetches the
latest version by itself. A project set up with 0.1.0 can rename
`docpensieve.config.js` to `docpensieve.config.mjs`, which Node reads as a
module whatever the `package.json` says: the warning printed on every build
goes away.

## Documentation

See the [repository](https://github.com/Juniors017/docpensieve#readme).

## License

MIT
