export const PLUGIN_NAME = "@docleus/plugin-blocks-commonmark";

export const BLOCK_TYPES = {
  heading: "commonmark.heading",
  list: "commonmark.list",
  listItem: "commonmark.list-item",
  blockquote: "commonmark.blockquote",
  code: "commonmark.code",
  table: "commonmark.table",
  tableRow: "commonmark.table-row",
  tableCell: "commonmark.table-cell",
  thematicBreak: "commonmark.thematic-break",
} as const;

export const INLINE_TYPES = {
  image: "commonmark.image",
  break: "commonmark.break",
} as const;

/** Every block type this plugin defines is at schema version 1. */
export const BLOCK_VERSION = 1;

export type Align = "left" | "right" | "center" | null;

export interface HeadingAttrs {
  readonly depth: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ListAttrs {
  readonly ordered: boolean;
  /** The first number of an ordered list; `null` for bullet lists. */
  readonly start: number | null;
  /** Loose lists separate their items with blank lines. */
  readonly spread: boolean;
}

export interface ListItemAttrs {
  /** `true` or `false` for task list items, `null` otherwise. */
  readonly checked: boolean | null;
}

export interface CodeAttrs {
  readonly lang: string | null;
  readonly meta: string | null;
  readonly value: string;
}

export interface TableAttrs {
  readonly align: readonly Align[];
}

export interface ImageAttrs {
  readonly src: string;
  readonly alt: string;
  readonly title?: string;
}
