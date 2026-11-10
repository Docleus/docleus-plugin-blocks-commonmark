<p align="center">
  <a href="https://docleus.io"><img src="./.github/assets/docleus.svg" width="88" alt="Docleus logo" /></a>
</p>

<h1 align="center">CommonMark Blocks</h1>

<p align="center">
  <strong>Familiar Markdown. Structured content.</strong><br />
  CommonMark and GFM blocks across import, editing, and published sites.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" /></a>
  <img alt="Public preview in preparation" src="https://img.shields.io/badge/preview-0.0.9-cfcfcf?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square" />
  <a href="https://docleus.io"><img alt="Online documentation" src="https://img.shields.io/badge/docs-docleus.io-111111?style=flat-square" /></a>
</p>

<p align="center">
  <a href="https://docleus.io">Documentation</a> &middot;
  <a href="#block-types">Block types</a> &middot;
  <a href="https://github.com/Docleus/docleus">Run Docleus</a> &middot;
  <a href="https://github.com/Docleus/.github/blob/main/CONTRIBUTING.md">Contribute</a>
</p>

---

CommonMark and GFM blocks for Docleus: headings, ordered and unordered lists, task lists, blockquotes, fenced and indented code, images, tables, and thematic breaks.

## Block types

| Type                        | Attrs                                                   |
| --------------------------- | ------------------------------------------------------- |
| `commonmark.heading`        | `depth` (1 to 6)                                        |
| `commonmark.list`           | `ordered`, `start`, `spread`                            |
| `commonmark.list-item`      | `checked` (`true`, `false`, or `null` for a plain item) |
| `commonmark.blockquote`     | none                                                    |
| `commonmark.code`           | `lang`, `meta`, `value`                                 |
| `commonmark.table`          | `align` (one entry per column)                          |
| `commonmark.table-row`      | none                                                    |
| `commonmark.table-cell`     | none                                                    |
| `commonmark.thematic-break` | none                                                    |

Inline nodes: `commonmark.image` (`src`, `alt`, `title`) and `commonmark.break`. Every type is at schema version 1.

## Entries

- `shared`: `BLOCK_TYPES`, `INLINE_TYPES`, `BLOCK_VERSION`, attrs types and validators, and `createCommonmarkCodec()`, which parses and prints the types above with the micromark GFM table and task list extensions.
- `server`: the plugin. It needs the `blocks`, `markdown`, and `render` services, and registers the block types, the codec, and HTML renderers for these types plus core `paragraph` and `raw` blocks.

- `editor`: the browser plugin. It needs the `editor` service from docleus-plugin-editor and registers every type above with views, settings panels (heading level, list kind and start, task list, table size and alignment, image source), Markdown-like input shortcuts, and toolbar and slash menu items. It uses only the high-level editor API, so it imports neither Tiptap nor ProseMirror.

Headings render with an `id` from `RenderContext.anchor`, unique within the page (the second "Usage" heading gets `usage-2`), and each adds an entry with its anchor, depth, and plain text to the result's `outline`, which a site theme can use for a table of contents. Container blocks pass the outline of their children through.

The renderers escape all text, show raw HTML as escaped text, and drop `javascript:`, `vbscript:`, `file:`, and non-image `data:` URLs.

## Constraints

- Unchanged blocks export from their original source slice, so imported Markdown keeps its formatting until a block is edited.
- GFM splits table cells on `|` before parsing inline code, so a cell's code span cannot hold `\|` preceded by another backslash.
- List looseness is read from source lines as CommonMark defines it, because micromark 4.0.3 marks a list loose when a blank line inside a container separates it from a following blockquote or list.
- micromark 4.0.3 does not parse an ordered list starting at a number other than 1 as the first block of a container that opens on the line after a paragraph (`* a\n  > 0. b`), although CommonMark does. The printer does not work around this yet.
- A task item whose first paragraph has no Markdown form prints as a generic tag inside a plain item, since a checkbox only marks a task in front of a paragraph.

In the editor:

- When this plugin is disabled for a space, its blocks show as placeholders in the editor and are saved unchanged.
- Rows and columns are added and removed from the table settings panel, at the cursor's cell (or at the end of the table when the table itself is selected).
- Typing `[ ] ` or `[x] ` at the start of a line starts a task; at the start of a list item it turns the item into a task.

## Development

Use Node.js 24 and pnpm 11.21.0. Keep this repository next to `docleus-core`
with its original directory name; the `link:` development dependencies need
that layout. Install core before this repository:

```sh
pnpm --dir ../docleus-core install --frozen-lockfile
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

`pnpm check` runs typecheck, lint, formatting, dependency boundaries, licenses,
and unit/in-process integration tests. Browser and external-service tests,
where provided, are separate and need the sibling repositories listed in
their setup files. The SDK is a host-provided peer dependency; packages remain
private and are not installed from npm. All extension points are experimental
before 1.0.

## Community

[Contributing](https://github.com/Docleus/.github/blob/main/CONTRIBUTING.md) &middot;
[Code of conduct](https://github.com/Docleus/.github/blob/main/CODE_OF_CONDUCT.md) &middot;
[Security](https://github.com/Docleus/.github/blob/main/SECURITY.md) &middot;
[Support](https://github.com/Docleus/.github/blob/main/SUPPORT.md)

## License

[MIT](LICENSE)

## Compatibility

Version `0.0.9` supports Docleus core and SDK `0.0.1`, `0.0.2`, `0.0.3`, `0.0.4`, `0.0.5`, `0.0.6`, `0.0.7`, `0.0.8` and `0.0.9` through
the matching `>=0.0.1 <0.0.10` manifest and SDK peer ranges.
