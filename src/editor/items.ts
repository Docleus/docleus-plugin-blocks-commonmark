import type {
  EditorHandle,
  EditorSlashItem,
  EditorToolbarItem,
} from "@docleus/sdk";
import { BLOCK_TYPES, INLINE_TYPES } from "../shared/types.ts";
import { BULLET_LIST, ORDERED_LIST } from "./definitions.ts";
import { newTable } from "./views.tsx";

const ITEM_PREFIX = "commonmark";

const heading = (depth: number) => ({
  id: `${ITEM_PREFIX}.heading-${depth}`,
  label: `Heading ${depth}`,
  keywords: ["title", `h${depth}`],
  order: depth,
  run: (editor: EditorHandle) =>
    editor.setBlock(BLOCK_TYPES.heading, { depth }),
});

const toggleList =
  (attrs: Readonly<Record<string, unknown>>) => (editor: EditorHandle) => {
    if (editor.isActive(BLOCK_TYPES.list)) {
      editor.updateBlock(BLOCK_TYPES.list, attrs);
      return;
    }
    editor.wrapIn(BLOCK_TYPES.list, attrs);
  };

function insertImage(editor: EditorHandle): void {
  const src = window.prompt("Image URL")?.trim();
  if (!src) return;
  editor.insertInline(INLINE_TYPES.image, { src, alt: "", title: null });
}

export const SLASH_ITEMS: readonly EditorSlashItem[] = [
  heading(1),
  heading(2),
  heading(3),
  {
    id: `${ITEM_PREFIX}.bullet-list`,
    label: "Bulleted list",
    keywords: ["unordered", "ul"],
    order: 10,
    run: toggleList(BULLET_LIST),
  },
  {
    id: `${ITEM_PREFIX}.ordered-list`,
    label: "Numbered list",
    keywords: ["ordered", "ol"],
    order: 11,
    run: toggleList(ORDERED_LIST),
  },
  {
    id: `${ITEM_PREFIX}.task-list`,
    label: "Task list",
    keywords: ["todo", "checkbox"],
    order: 12,
    run: (editor) => {
      if (!editor.wrapIn(BLOCK_TYPES.list, BULLET_LIST)) return;
      editor.updateBlock(BLOCK_TYPES.listItem, { checked: false });
    },
  },
  {
    id: `${ITEM_PREFIX}.blockquote`,
    label: "Quote",
    keywords: ["blockquote"],
    order: 20,
    run: (editor) => editor.wrapIn(BLOCK_TYPES.blockquote),
  },
  {
    id: `${ITEM_PREFIX}.code`,
    label: "Code block",
    keywords: ["pre", "snippet"],
    order: 30,
    run: (editor) => editor.insertBlock(BLOCK_TYPES.code),
  },
  {
    id: `${ITEM_PREFIX}.table`,
    label: "Table",
    keywords: ["grid"],
    order: 40,
    run: (editor) => editor.insertTree(newTable(2, 2)),
  },
  {
    id: `${ITEM_PREFIX}.thematic-break`,
    label: "Divider",
    keywords: ["rule", "hr", "separator"],
    order: 50,
    run: (editor) => editor.insertBlock(BLOCK_TYPES.thematicBreak),
  },
  {
    id: `${ITEM_PREFIX}.image`,
    label: "Image",
    keywords: ["picture", "img"],
    order: 60,
    run: insertImage,
  },
];

export const TOOLBAR_ITEMS: readonly EditorToolbarItem[] = [
  {
    id: `${ITEM_PREFIX}.heading`,
    label: "Heading",
    group: ITEM_PREFIX,
    order: 10,
    isActive: (editor) => editor.isActive(BLOCK_TYPES.heading),
    run: (editor) =>
      editor.isActive(BLOCK_TYPES.heading)
        ? editor.setBlock("paragraph")
        : editor.setBlock(BLOCK_TYPES.heading, { depth: 2 }),
  },
  {
    id: `${ITEM_PREFIX}.bullet-list`,
    label: "List",
    group: ITEM_PREFIX,
    order: 11,
    isActive: (editor) => editor.isActive(BLOCK_TYPES.list),
    run: toggleList(BULLET_LIST),
  },
  {
    id: `${ITEM_PREFIX}.blockquote`,
    label: "Quote",
    group: ITEM_PREFIX,
    order: 12,
    isActive: (editor) => editor.isActive(BLOCK_TYPES.blockquote),
    run: (editor) => editor.wrapIn(BLOCK_TYPES.blockquote),
  },
];
