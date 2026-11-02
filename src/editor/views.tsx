import type {
  BlockNode,
  BlockSettingsProps,
  BlockViewProps,
} from "@docleus/sdk";
import type { ComponentType } from "react";
import { BLOCK_TYPES, BLOCK_VERSION } from "../shared/types.ts";
import { safeImageUrl } from "../shared/url.ts";

const stringOf = (value: unknown): string =>
  typeof value === "string" ? value : "";

const orNull = (value: string): string | null => (value === "" ? null : value);

const contentOf = (props: BlockViewProps) =>
  props.Content as ComponentType<{ readonly as?: string }>;

export function CodeView(props: BlockViewProps) {
  const { attrs, isEditable, updateAttrs } = props;
  const lang = stringOf(attrs.lang);
  if (!isEditable) {
    return (
      <div className="commonmark-code is-reading" contentEditable={false}>
        {lang !== "" && <span className="commonmark-code-lang">{lang}</span>}
        <pre className="commonmark-code-value">
          <code>{stringOf(attrs.value)}</code>
        </pre>
      </div>
    );
  }
  return (
    <div className="commonmark-code" contentEditable={false}>
      <input
        className="commonmark-code-lang"
        aria-label="Code language"
        placeholder="language"
        value={lang}
        onChange={(event) => updateAttrs({ lang: orNull(event.target.value) })}
      />
      <textarea
        className="commonmark-code-value"
        aria-label="Code"
        spellCheck={false}
        rows={Math.max(2, stringOf(attrs.value).split("\n").length)}
        value={stringOf(attrs.value)}
        onChange={(event) => updateAttrs({ value: event.target.value })}
      />
    </div>
  );
}

export function ListItemView(props: BlockViewProps) {
  const { attrs, isEditable, updateAttrs } = props;
  const Content = contentOf(props);
  const { checked } = attrs;
  return (
    <div
      className="commonmark-list-item"
      data-checked={checked === null ? undefined : String(checked)}
    >
      {typeof checked === "boolean" &&
        (isEditable ? (
          <input
            type="checkbox"
            className="commonmark-task"
            aria-label="Done"
            contentEditable={false}
            checked={checked}
            onChange={(event) => updateAttrs({ checked: event.target.checked })}
          />
        ) : (
          // A reader cannot change it, but a disabled control reads as unavailable.
          <span
            role="checkbox"
            aria-checked={checked}
            aria-label="Done"
            className="commonmark-task is-reading"
            contentEditable={false}
          />
        ))}
      <Content as="div" />
    </div>
  );
}

export function ImageView(props: Omit<BlockViewProps, "Content">) {
  const src = safeImageUrl(stringOf(props.attrs.src));
  const alt = stringOf(props.attrs.alt);
  const title = stringOf(props.attrs.title) || undefined;
  if (!src) {
    return (
      <span className="commonmark-image-missing" title={title}>
        {alt || "Image"}
      </span>
    );
  }
  return <img className="commonmark-image" src={src} alt={alt} title={title} />;
}

export function HeadingSettings(props: BlockSettingsProps) {
  return (
    <label>
      Heading level{" "}
      <select
        value={String(props.attrs.depth)}
        onChange={(event) =>
          props.updateAttrs({ depth: Number(event.target.value) })
        }
      >
        {[1, 2, 3, 4, 5, 6].map((depth) => (
          <option key={depth} value={depth}>
            {depth}
          </option>
        ))}
      </select>
    </label>
  );
}

const isTaskList = (block: BlockNode | undefined) =>
  (block?.content ?? []).some(
    (item) => typeof item.attrs.checked === "boolean",
  );

export function ListSettings(props: BlockSettingsProps) {
  const { attrs, block, replaceBlock, updateAttrs } = props;
  const isOrdered = attrs.ordered === true;
  const isTask = isTaskList(block);
  return (
    <div className="commonmark-settings">
      <label>
        <input
          type="checkbox"
          checked={isOrdered}
          onChange={(event) =>
            updateAttrs(
              event.target.checked
                ? { ordered: true, start: 1 }
                : { ordered: false, start: null },
            )
          }
        />{" "}
        Numbered
      </label>
      {isOrdered && (
        <label>
          Start at{" "}
          <input
            type="number"
            min={0}
            value={String(attrs.start ?? 1)}
            onChange={(event) => {
              const start = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(start) && start >= 0) updateAttrs({ start });
            }}
          />
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={attrs.spread === true}
          onChange={(event) => updateAttrs({ spread: event.target.checked })}
        />{" "}
        Loose
      </label>
      {block && (
        <label>
          <input
            type="checkbox"
            checked={isTask}
            onChange={(event) =>
              replaceBlock(withTasks(block, event.target.checked))
            }
          />{" "}
          Task list
        </label>
      )}
    </div>
  );
}

/** The list with every item turned into a task, or back into a plain item. */
export function withTasks(list: BlockNode, isTask: boolean): BlockNode {
  return {
    ...list,
    content: (list.content ?? []).map((item) => ({
      ...item,
      attrs: {
        ...item.attrs,
        checked: isTask ? item.attrs.checked === true : null,
      },
    })),
  };
}

const newCell = (): BlockNode => ({
  id: "",
  type: BLOCK_TYPES.tableCell,
  v: BLOCK_VERSION,
  attrs: {},
});

const newRow = (columns: number): BlockNode => ({
  id: "",
  type: BLOCK_TYPES.tableRow,
  v: BLOCK_VERSION,
  attrs: {},
  content: Array.from({ length: columns }, newCell),
});

/** An empty table with a header row. */
export function newTable(rows: number, columns: number): BlockNode {
  return {
    id: "",
    type: BLOCK_TYPES.table,
    v: BLOCK_VERSION,
    attrs: { align: Array.from({ length: columns }, () => null) },
    content: Array.from({ length: rows }, () => newRow(columns)),
  };
}

const columnsOf = (table: BlockNode): number =>
  Math.max(1, ...(table.content ?? []).map((row) => row.content?.length ?? 0));

const alignOf = (table: BlockNode): unknown[] =>
  Array.isArray(table.attrs.align) ? [...(table.attrs.align as unknown[])] : [];

/** `items` with `item` inserted after index `after`, or at the end. */
const insertAfter = <T,>(items: readonly T[], item: T, after?: number): T[] => {
  const at = after === undefined ? items.length : after + 1;
  return [...items.slice(0, at), item, ...items.slice(at)];
};

/** `items` without index `index`, or without the last item. */
const removeAt = <T,>(items: readonly T[], index?: number): T[] => {
  const at = index ?? items.length - 1;
  return items.filter((_, i) => i !== at);
};

/**
 * Table edits by row and column, all of which keep the cells' ids. Rows and
 * columns are added after the given index (`-1` adds them first) and removed
 * at it; without an index, at the end.
 */
export const tableEdits = {
  addRow: (table: BlockNode, after?: number): BlockNode => ({
    ...table,
    content: insertAfter(table.content ?? [], newRow(columnsOf(table)), after),
  }),
  removeRow: (table: BlockNode, index?: number): BlockNode => ({
    ...table,
    content: removeAt(table.content ?? [], index),
  }),
  addColumn: (table: BlockNode, after?: number): BlockNode => ({
    ...table,
    attrs: { ...table.attrs, align: insertAfter(alignOf(table), null, after) },
    content: (table.content ?? []).map((row) => ({
      ...row,
      content: insertAfter(row.content ?? [], newCell(), after),
    })),
  }),
  removeColumn: (table: BlockNode, index?: number): BlockNode => ({
    ...table,
    attrs: { ...table.attrs, align: removeAt(alignOf(table), index) },
    content: (table.content ?? []).map((row) => ({
      ...row,
      content: removeAt(row.content ?? [], index),
    })),
  }),
};

/**
 * Table settings; rows and columns are added on either side of the cursor's
 * cell and removed at it, or, without a cell, added and removed at the end.
 */
export function TableSettings(props: BlockSettingsProps) {
  const { block, path, replaceBlock } = props;
  if (!block) return null;
  const rows = block.content?.length ?? 0;
  const columns = columnsOf(block);
  const [row, column] = path;
  const isInCell = row !== undefined && column !== undefined;
  return (
    <div className="commonmark-settings" role="group" aria-label="Table">
      {isInCell && (
        <button
          type="button"
          onClick={() =>
            replaceBlock(tableEdits.addRow(block, row - 1), [row, column])
          }
        >
          Add row above
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          replaceBlock(
            tableEdits.addRow(block, row),
            isInCell ? [row + 1, column] : undefined,
          )
        }
      >
        {isInCell ? "Add row below" : "Add row"}
      </button>
      <button
        type="button"
        disabled={rows <= 1}
        onClick={() => replaceBlock(tableEdits.removeRow(block, row))}
      >
        {isInCell ? "Remove row" : "Remove last row"}
      </button>
      {isInCell && (
        <button
          type="button"
          onClick={() =>
            replaceBlock(tableEdits.addColumn(block, column - 1), [row, column])
          }
        >
          Add column left
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          replaceBlock(
            tableEdits.addColumn(block, column),
            isInCell ? [row, column + 1] : undefined,
          )
        }
      >
        {isInCell ? "Add column right" : "Add column"}
      </button>
      <button
        type="button"
        disabled={columns <= 1}
        onClick={() => replaceBlock(tableEdits.removeColumn(block, column))}
      >
        {isInCell ? "Remove column" : "Remove last column"}
      </button>
    </div>
  );
}

export function ImageSettings(props: BlockSettingsProps) {
  const { attrs, updateAttrs } = props;
  const field = (key: "src" | "alt" | "title", label: string) => (
    <label>
      {label}{" "}
      <input
        value={stringOf(attrs[key])}
        onChange={(event) =>
          updateAttrs({
            [key]:
              key === "title" ? orNull(event.target.value) : event.target.value,
          })
        }
      />
    </label>
  );
  return (
    <div className="commonmark-settings">
      {field("src", "URL")}
      {field("alt", "Alt text")}
      {field("title", "Title")}
    </div>
  );
}
