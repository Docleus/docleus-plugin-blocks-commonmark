// @vitest-environment happy-dom
import {
  Context,
  editorNodeName,
  type BlockNode,
  type EditorBlockDefinition,
  type EditorHandle,
  type EditorService,
  trackCaller,
} from "@docleus/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCK_TYPES, INLINE_TYPES, PLUGIN_NAME } from "../shared/types.ts";
import {
  BLOCK_DEFINITIONS,
  INLINE_DEFINITIONS,
  plugin,
  SLASH_ITEMS,
} from "./index.ts";
import { newTable, tableEdits, withTasks } from "./views.tsx";

function fakeEditorService(owner: Context) {
  const registered = new Set<string>();
  const add = (caller: Context, key: string) =>
    caller.effect(() => {
      registered.add(key);
      return () => registered.delete(key);
    }, key);
  const service = trackCaller<EditorService>(owner, {
    registerBlock(definition) {
      return add(this.ctx, `block:${definition.type}`);
    },
    registerInline(definition) {
      return add(this.ctx, `inline:${definition.type}`);
    },
    registerMark(definition) {
      return add(this.ctx, `mark:${definition.type}`);
    },
    registerToolbarItem(item) {
      return add(this.ctx, `toolbar:${item.id}`);
    },
    registerSlashItem(item) {
      return add(this.ctx, `slash:${item.id}`);
    },
    registerExtension() {
      return add(this.ctx, "extension");
    },
    registerCollaboration() {
      return add(this.ctx, "collaboration");
    },
  });
  return { service, registered };
}

function fakeHandle(): EditorHandle & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
      return true;
    };
  return {
    calls,
    isActive: () => false,
    toggleMark: record("toggleMark"),
    setBlock: record("setBlock"),
    wrapIn: record("wrapIn"),
    insertBlock: record("insertBlock"),
    insertTree: record("insertTree"),
    updateBlock: record("updateBlock"),
    insertInline: record("insertInline"),
    focus: () => {},
    unstable_tiptap: undefined,
  };
}

const definitionOf = (type: string): EditorBlockDefinition => {
  const found = BLOCK_DEFINITIONS.find(
    (definition) => definition.type === type,
  );
  if (!found) throw new Error(`no definition for ${type}`);
  return found;
};

const matchOf = (type: string, text: string) =>
  (definitionOf(type).shortcuts ?? [])
    .map((shortcut) => {
      const match = shortcut.pattern.exec(text);
      return match && { attrs: shortcut.attrs?.(match) ?? {} };
    })
    .find(Boolean);

const run = (id: string, handle = fakeHandle()) => {
  const item = SLASH_ITEMS.find((candidate) => candidate.id === id);
  item?.run(handle);
  return handle.calls;
};

const ids = (node: BlockNode) =>
  (node.content ?? []).map((row) => (row.content ?? []).map((cell) => cell.id));

describe("editor plugin", () => {
  it("registers every type and its styles, and undoes it on unload", async () => {
    const root = new Context();
    const { service, registered } = fakeEditorService(root);
    root.provide("editor", service);
    const fiber = await root.plugin(plugin);
    for (const type of Object.values(BLOCK_TYPES)) {
      expect(registered).toContain(`block:${type}`);
    }
    for (const type of Object.values(INLINE_TYPES)) {
      expect(registered).toContain(`inline:${type}`);
    }
    for (const item of SLASH_ITEMS) {
      expect(registered).toContain(`slash:${item.id}`);
    }
    expect(
      document.head.querySelector(`style[data-plugin="${PLUGIN_NAME}"]`),
    ).not.toBeNull();

    await fiber.dispose();
    expect(registered.size).toBe(0);
    expect(
      document.head.querySelector(`style[data-plugin="${PLUGIN_NAME}"]`),
    ).toBeNull();
  });

  it("names child types by their editor node names", () => {
    expect(definitionOf(BLOCK_TYPES.list).children).toBe(
      `${editorNodeName(BLOCK_TYPES.listItem)}+`,
    );
    expect(definitionOf(BLOCK_TYPES.table).children).toBe(
      `${editorNodeName(BLOCK_TYPES.tableRow)}+`,
    );
    expect(definitionOf(BLOCK_TYPES.tableRow).children).toBe(
      `${editorNodeName(BLOCK_TYPES.tableCell)}+`,
    );
  });

  it("keeps list semantics for list items, which have a view", () => {
    expect(definitionOf(BLOCK_TYPES.listItem).tag).toBe("li");
  });

  it("gives new blocks attrs the codec accepts", () => {
    expect(definitionOf(BLOCK_TYPES.code).attrs).toEqual({
      lang: null,
      meta: null,
      value: "",
    });
    expect(definitionOf(BLOCK_TYPES.list).attrs).toEqual({
      ordered: false,
      start: null,
      spread: false,
    });
    expect(
      INLINE_DEFINITIONS.find((d) => d.type === INLINE_TYPES.image)?.attrs,
    ).toEqual({ src: "", alt: "", title: null });
  });
});

describe("shortcuts", () => {
  it.each([
    [BLOCK_TYPES.heading, "### ", { depth: 3 }],
    [BLOCK_TYPES.list, "- ", { ordered: false, start: null, spread: false }],
    [BLOCK_TYPES.list, "* ", { ordered: false, start: null, spread: false }],
    [BLOCK_TYPES.list, "3. ", { ordered: true, start: 3, spread: false }],
    [BLOCK_TYPES.blockquote, "> ", {}],
    [BLOCK_TYPES.code, "```ts ", { lang: "ts" }],
    [BLOCK_TYPES.code, "``` ", { lang: null }],
    [BLOCK_TYPES.thematicBreak, "---", {}],
    [BLOCK_TYPES.listItem, "[ ] ", { checked: false }],
    [BLOCK_TYPES.listItem, "[x] ", { checked: true }],
  ])("%s matches %j", (type, text, attrs) => {
    expect(matchOf(type, text)).toEqual({ attrs });
  });

  it.each([
    [BLOCK_TYPES.heading, "####### "],
    [BLOCK_TYPES.heading, "#title"],
    [BLOCK_TYPES.list, "-x"],
    [BLOCK_TYPES.thematicBreak, "--"],
    [BLOCK_TYPES.listItem, "[] "],
  ])("%s ignores %j", (type, text) => {
    expect(matchOf(type, text)).toBeUndefined();
  });

  it("inserts a hard break on Shift-Enter", () => {
    const handle = fakeHandle();
    const keys = INLINE_DEFINITIONS.find(
      (d) => d.type === INLINE_TYPES.break,
    )?.keys;
    expect(keys?.["Shift-Enter"]?.(handle)).toBe(true);
    expect(handle.calls).toEqual([["insertInline", INLINE_TYPES.break]]);
  });
});

describe("slash items", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("set headings and wrap lists", () => {
    expect(run("commonmark.heading-2")).toEqual([
      ["setBlock", BLOCK_TYPES.heading, { depth: 2 }],
    ]);
    expect(run("commonmark.ordered-list")).toEqual([
      ["wrapIn", BLOCK_TYPES.list, { ordered: true, start: 1, spread: false }],
    ]);
    expect(run("commonmark.task-list")).toEqual([
      [
        "wrapIn",
        BLOCK_TYPES.list,
        { ordered: false, start: null, spread: false },
      ],
      ["updateBlock", BLOCK_TYPES.listItem, { checked: false }],
    ]);
  });

  it("insert a 2x2 table with a null align per column", () => {
    const [call] = run("commonmark.table");
    expect(call?.[0]).toBe("insertTree");
    expect(call?.[1]).toEqual(newTable(2, 2));
    expect(newTable(2, 2).attrs).toEqual({ align: [null, null] });
  });

  it("insert an image only when a URL is given", () => {
    vi.stubGlobal("prompt", () => " a.png ");
    expect(run("commonmark.image")).toEqual([
      [
        "insertInline",
        INLINE_TYPES.image,
        { src: "a.png", alt: "", title: null },
      ],
    ]);
    vi.stubGlobal("prompt", () => null);
    expect(run("commonmark.image")).toEqual([]);
  });
});

describe("table and list edits", () => {
  const table: BlockNode = {
    ...newTable(2, 2),
    id: "t",
    content: newTable(2, 2).content?.map((row, r) => ({
      ...row,
      id: `r${r}`,
      content: row.content?.map((cell, c) => ({ ...cell, id: `c${r}${c}` })),
    })),
  };

  it("add and remove rows and columns, keeping existing ids", () => {
    expect(ids(tableEdits.addRow(table))).toEqual([
      ["c00", "c01"],
      ["c10", "c11"],
      ["", ""],
    ]);
    expect(ids(tableEdits.removeRow(table))).toEqual([["c00", "c01"]]);
    const wider = tableEdits.addColumn(table);
    expect(ids(wider)).toEqual([
      ["c00", "c01", ""],
      ["c10", "c11", ""],
    ]);
    expect(wider.attrs.align).toEqual([null, null, null]);
    const narrower = tableEdits.removeColumn(table);
    expect(ids(narrower)).toEqual([["c00"], ["c10"]]);
    expect(narrower.attrs.align).toEqual([null]);
  });

  it("add and remove rows and columns at an index", () => {
    expect(ids(tableEdits.addRow(table, 0))).toEqual([
      ["c00", "c01"],
      ["", ""],
      ["c10", "c11"],
    ]);
    expect(ids(tableEdits.removeRow(table, 0))).toEqual([["c10", "c11"]]);
    const aligned = { ...table, attrs: { align: ["left", "right"] } };
    const wider = tableEdits.addColumn(aligned, 0);
    expect(ids(wider)).toEqual([
      ["c00", "", "c01"],
      ["c10", "", "c11"],
    ]);
    expect(wider.attrs.align).toEqual(["left", null, "right"]);
    expect(ids(tableEdits.addRow(table, -1))[0]).toEqual(["", ""]);
    expect(ids(tableEdits.addColumn(aligned, -1))).toEqual([
      ["", "c00", "c01"],
      ["", "c10", "c11"],
    ]);
    expect(tableEdits.addColumn(aligned, -1).attrs.align).toEqual([
      null,
      "left",
      "right",
    ]);
    const narrower = tableEdits.removeColumn(aligned, 0);
    expect(ids(narrower)).toEqual([["c01"], ["c11"]]);
    expect(narrower.attrs.align).toEqual(["right"]);
  });

  it("turn list items into tasks and back", () => {
    const list = {
      id: "l",
      type: BLOCK_TYPES.list,
      v: 1,
      attrs: { ordered: false, start: null, spread: false },
      content: [
        { id: "a", type: BLOCK_TYPES.listItem, v: 1, attrs: { checked: null } },
        { id: "b", type: BLOCK_TYPES.listItem, v: 1, attrs: { checked: true } },
      ],
    };
    const tasks = withTasks(list, true);
    expect(tasks.content?.map((item) => item.attrs.checked)).toEqual([
      false,
      true,
    ]);
    expect(
      withTasks(tasks, false).content?.map((item) => item.attrs.checked),
    ).toEqual([null, null]);
  });
});
