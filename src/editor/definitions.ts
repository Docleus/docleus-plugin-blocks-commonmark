import {
  editorNodeName,
  type EditorBlockDefinition,
  type EditorInlineDefinition,
} from "@docleus/sdk";
import { BLOCK_TYPES, BLOCK_VERSION, INLINE_TYPES } from "../shared/types.ts";
import {
  CodeView,
  HeadingSettings,
  ImageSettings,
  ImageView,
  ListItemView,
  ListSettings,
  TableSettings,
} from "./views.tsx";

const LIST_ITEM_GROUP = "commonmarkListItem";
const TABLE_ROW_GROUP = "commonmarkTableRow";
const TABLE_CELL_GROUP = "commonmarkTableCell";

/** Attrs of a new bullet list. */
export const BULLET_LIST = { ordered: false, start: null, spread: false };
/** Attrs of a new ordered list. */
export const ORDERED_LIST = { ordered: true, start: 1, spread: false };

export const BLOCK_DEFINITIONS: readonly EditorBlockDefinition[] = [
  {
    type: BLOCK_TYPES.heading,
    version: BLOCK_VERSION,
    content: "inline",
    attrs: { depth: 1 },
    tag: (attrs) => `h${String(attrs.depth)}`,
    isDefining: true,
    settings: HeadingSettings,
    shortcuts: [
      {
        pattern: /^(#{1,6})\s$/,
        attrs: (match) => ({ depth: match[1]?.length ?? 1 }),
      },
    ],
  },
  {
    type: BLOCK_TYPES.list,
    version: BLOCK_VERSION,
    content: "blocks",
    children: `${editorNodeName(BLOCK_TYPES.listItem)}+`,
    attrs: BULLET_LIST,
    tag: (attrs) => (attrs.ordered === true ? "ol" : "ul"),
    settings: ListSettings,
    shortcuts: [
      { pattern: /^\s*([-+*])\s$/, attrs: () => BULLET_LIST },
      {
        pattern: /^(\d+)\.\s$/,
        attrs: (match) => ({ ...ORDERED_LIST, start: Number(match[1]) }),
      },
    ],
  },
  {
    type: BLOCK_TYPES.listItem,
    version: BLOCK_VERSION,
    content: "blocks",
    group: LIST_ITEM_GROUP,
    attrs: { checked: null },
    isListItem: true,
    isDefining: true,
    tag: "li",
    view: ListItemView,
    // Typed at the start of an item, `[ ] ` makes it a task; elsewhere it
    // starts a bullet list with a task.
    shortcuts: [
      {
        pattern: /^\[([ xX])\]\s$/,
        attrs: (match) => ({ checked: match[1] !== " " }),
      },
    ],
  },
  {
    type: BLOCK_TYPES.blockquote,
    version: BLOCK_VERSION,
    content: "blocks",
    tag: "blockquote",
    isDefining: true,
    shortcuts: [{ pattern: /^>\s$/ }],
  },
  {
    // An atom: the codec keeps the code in attrs.value, so the view edits it.
    type: BLOCK_TYPES.code,
    version: BLOCK_VERSION,
    content: "atom",
    attrs: { lang: null, meta: null, value: "" },
    view: CodeView,
    shortcuts: [
      {
        pattern: /^```([\w-]+)?\s$/,
        attrs: (match) => ({ lang: match[1] ?? null }),
      },
    ],
  },
  {
    type: BLOCK_TYPES.table,
    version: BLOCK_VERSION,
    content: "blocks",
    children: `${editorNodeName(BLOCK_TYPES.tableRow)}+`,
    attrs: { align: [] },
    tag: "table",
    isIsolating: true,
    settings: TableSettings,
  },
  {
    type: BLOCK_TYPES.tableRow,
    version: BLOCK_VERSION,
    content: "blocks",
    group: TABLE_ROW_GROUP,
    children: `${editorNodeName(BLOCK_TYPES.tableCell)}+`,
    tag: "tr",
  },
  {
    type: BLOCK_TYPES.tableCell,
    version: BLOCK_VERSION,
    content: "inline",
    group: TABLE_CELL_GROUP,
    tag: "td",
    isIsolating: true,
    // A cell holds one line of Markdown, so Enter must not split it.
    keys: { Enter: () => true },
  },
  {
    type: BLOCK_TYPES.thematicBreak,
    version: BLOCK_VERSION,
    content: "atom",
    tag: "hr",
    shortcuts: [{ pattern: /^(?:---|—-|___\s|\*\*\*\s)$/ }],
  },
];

export const INLINE_DEFINITIONS: readonly EditorInlineDefinition[] = [
  {
    type: INLINE_TYPES.image,
    attrs: { src: "", alt: "", title: null },
    view: ImageView,
    settings: ImageSettings,
  },
  {
    type: INLINE_TYPES.break,
    tag: "br",
    keys: {
      "Shift-Enter": (editor) => editor.insertInline(INLINE_TYPES.break),
    },
  },
];
