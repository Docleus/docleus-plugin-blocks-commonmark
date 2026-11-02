// @vitest-environment happy-dom
import type { BlockNode, BlockSettingsProps, EditorHandle } from "@docleus/sdk";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { newTable, TableSettings } from "./views.tsx";

const unmounts: (() => void)[] = [];
afterEach(() => {
  for (const unmount of unmounts.splice(0)) act(unmount);
  document.body.replaceChildren();
});

function renderSettings(block: BlockNode, path: readonly number[]) {
  const replaced: [BlockNode, (readonly number[] | undefined)?][] = [];
  const props: BlockSettingsProps = {
    type: "commonmark.table",
    attrs: block.attrs,
    block,
    path,
    updateAttrs: () => {},
    replaceBlock: (next, target) => replaced.push([next, target]),
    // The table settings never reach the editor.
    editor: {} as EditorHandle,
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(createElement(TableSettings, props)));
  unmounts.push(() => root.unmount());
  const click = (label: string) => {
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    );
    if (!button) throw new Error(`No button ${label}`);
    act(() => button.click());
    return replaced.at(-1);
  };
  return { click };
}

const rowCount = (table: BlockNode | undefined) => table?.content?.length;
const columnCount = (table: BlockNode | undefined) =>
  table?.content?.[0]?.content?.length;

describe("TableSettings", () => {
  it("adds a row below the cursor's row and moves the cursor into it", () => {
    const { click } = renderSettings(newTable(3, 2), [0, 1]);
    const [table, target] = click("Add row below") ?? [];
    expect(rowCount(table)).toBe(4);
    expect(target).toEqual([1, 1]);
  });

  it("adds a column right of the cursor's column", () => {
    const { click } = renderSettings(newTable(2, 2), [1, 0]);
    const [table, target] = click("Add column right") ?? [];
    expect(columnCount(table)).toBe(3);
    expect(target).toEqual([1, 1]);
  });

  it("adds a row above the cursor's row and moves the cursor into it", () => {
    const { click } = renderSettings(newTable(3, 2), [1, 1]);
    const [table, target] = click("Add row above") ?? [];
    expect(rowCount(table)).toBe(4);
    expect(target).toEqual([1, 1]);
    expect(table?.content?.[1]?.content?.[0]?.id).toBe("");
  });

  it("adds a column left of the cursor's column, also at the first one", () => {
    const { click } = renderSettings(newTable(2, 2), [1, 0]);
    const [table, target] = click("Add column left") ?? [];
    expect(columnCount(table)).toBe(3);
    expect(target).toEqual([1, 0]);
    expect(table?.attrs.align).toEqual([null, null, null]);
  });

  it("offers no above or left outside a cell", () => {
    renderSettings(newTable(2, 2), []);
    const labels = [...document.querySelectorAll("button")].map(
      (button) => button.textContent,
    );
    expect(labels).not.toContain("Add row above");
    expect(labels).not.toContain("Add column left");
  });

  it("removes the cursor's row and column", () => {
    const table = newTable(3, 3);
    const { click } = renderSettings(table, [1, 2]);
    expect(rowCount(click("Remove row")?.[0])).toBe(2);
    expect(columnCount(click("Remove column")?.[0])).toBe(2);
  });

  it("works at the end of the table when no cell holds the cursor", () => {
    const { click } = renderSettings(newTable(2, 2), []);
    const [table, target] = click("Add row") ?? [];
    expect(rowCount(table)).toBe(3);
    expect(target).toBeUndefined();
    expect(columnCount(click("Remove last column")?.[0])).toBe(1);
  });
});
