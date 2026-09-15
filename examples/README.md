# Examples

Two complete projects, one per theme. Each builds as it is, and a test of the
repository builds and checks both on every run.

| Folder      | Shows                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `tailwind/` | The Tailwind theme, a menu written by hand, an RSS feed of the news pages |
| `custom/`   | The custom theme kept dark, and its own classes in `theme/custom.css`     |

From a folder, with the version of DocPensieve they are written for:

```bash
npx docpensieve@beta dev
```

Or, from a clone of the repository, with its own command:

```bash
node ../../packages/cli/bin/docpensieve.js dev
```
