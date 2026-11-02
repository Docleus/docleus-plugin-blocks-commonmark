import type {
  BlockNode,
  BlockSettingsProps,
  BlockViewProps,
  EditorHandle,
} from "@docleus/sdk";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES } from "../shared/types.ts";
import {
  CodeView,
  HeadingSettings,
  ImageSettings,
  ImageView,
  ListItemView,
  ListSettings,
  newTable,
  TableSettings,
  withTasks,
} from "./views.tsx";

const noop = () => {};

function Content(props: { readonly as?: string }) {
  return createElement(props.as ?? "div", { "data-content": "" });
}

const viewProps = (attrs: Record<string, unknown>): BlockViewProps => ({
  attrs,
  isEditable: true,
  isSelected: false,
  updateAttrs: noop,
  Content,
});

const settingsProps = (
  attrs: Record<string, unknown>,
  block?: BlockNode,
  path: readonly number[] = [],
): BlockSettingsProps => ({
  type: "test",
  attrs,
  block,
  path,
  updateAttrs: noop,
  replaceBlock: noop,
  // The settings panels under test never reach the editor.
  editor: {} as EditorHandle,
});

const html = <P extends object>(component: ComponentType<P>, props: P) =>
  renderToStaticMarkup(createElement(component, props));

const list: BlockNode = {
  id: "l",
  type: BLOCK_TYPES.list,
  v: 1,
  attrs: { ordered: true, start: 3, spread: false },
  content: [
    { id: "a", type: BLOCK_TYPES.listItem, v: 1, attrs: { checked: null } },
  ],
};

const readOnly = (attrs: Record<string, unknown>): BlockViewProps => ({
  ...viewProps(attrs),
  isEditable: false,
});

describe("read-only views", () => {
  it("shows code as text with its language, without editing controls", () => {
    const out = html(CodeView, readOnly({ lang: "ts", value: "a\nb" }));
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<textarea");
    expect(out).toContain("<pre");
    expect(out).toContain(">ts<");
    expect(out).toContain("a\nb");
  });

  it("leaves out the language label when there is none", () => {
    expect(html(CodeView, readOnly({ lang: null, value: "x" }))).not.toContain(
      "commonmark-code-lang",
    );
  });

  it("shows a task's state without a disabled control", () => {
    const out = html(ListItemView, readOnly({ checked: true }));
    expect(out).not.toContain("disabled");
    expect(out).toContain('role="checkbox"');
    expect(out).toContain('aria-checked="true"');
  });
});

describe("views", () => {
  it.each([
    ["code", () => html(CodeView, viewProps({ lang: "ts", value: "a\nb\nc" }))],
    ["a list item", () => html(ListItemView, viewProps({ checked: null }))],
    ["a task", () => html(ListItemView, viewProps({ checked: true }))],
    [
      "an image",
      () => html(ImageView, viewProps({ src: "a.png", alt: "A", title: "T" })),
    ],
    [
      "an unsafe image",
      () => html(ImageView, viewProps({ src: "javascript:x", alt: "A" })),
    ],
    [
      "heading settings",
      () => html(HeadingSettings, settingsProps({ depth: 2 })),
    ],
    [
      "list settings",
      () => html(ListSettings, settingsProps(list.attrs, list)),
    ],
    [
      "task list settings",
      () => {
        const tasks = withTasks(list, true);
        return html(ListSettings, settingsProps(tasks.attrs, tasks));
      },
    ],
    [
      "table settings",
      () => {
        const table = newTable(1, 2);
        return html(TableSettings, settingsProps(table.attrs, table));
      },
    ],
    [
      "table settings in a cell",
      () => {
        const table = newTable(2, 2);
        return html(TableSettings, settingsProps(table.attrs, table, [1, 0]));
      },
    ],
    [
      "image settings",
      () =>
        html(
          ImageSettings,
          settingsProps({ src: "a.png", alt: "", title: null }),
        ),
    ],
  ])("render %s", (_, render) => {
    expect(render()).toMatchSnapshot();
  });
});
