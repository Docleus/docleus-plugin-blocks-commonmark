import {
  DocleusError,
  type BlockNode,
  type InlineNode,
  type MarkdownCodec,
  type MarkdownCodecContext,
} from "@docleus/sdk";
import type {
  Blockquote,
  List,
  ListItem,
  PhrasingContent,
  RootContent,
  TableCell,
  TableRow,
} from "mdast";
import { gfmTableFromMarkdown, gfmTableToMarkdown } from "mdast-util-gfm-table";
import {
  gfmTaskListItemFromMarkdown,
  gfmTaskListItemToMarkdown,
} from "mdast-util-gfm-task-list-item";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTaskListItem } from "micromark-extension-gfm-task-list-item";
import {
  parseCodeAttrs,
  parseHeadingAttrs,
  parseImageAttrs,
  parseListAttrs,
  parseListItemAttrs,
  parseTableAttrs,
} from "./attrs.ts";
import {
  BLOCK_TYPES,
  BLOCK_VERSION,
  INLINE_TYPES,
  PLUGIN_NAME,
} from "./types.ts";

type Attrs = Record<string, unknown>;

function block(
  context: MarkdownCodecContext,
  type: string,
  attrs: Attrs,
  children: { content?: BlockNode[]; inline?: InlineNode[] } = {},
): BlockNode {
  return { id: context.newId(), type, v: BLOCK_VERSION, attrs, ...children };
}

function lastLine(node: RootContent): number | undefined {
  if (node.type === "list" || node.type === "listItem") {
    const last = node.children.at(-1);
    if (last) return lastLine(last);
  }
  return node.position?.end.line;
}

function hasBlankLineBetween(nodes: readonly RootContent[]): boolean {
  return nodes.some((node, i) => {
    const end = lastLine(node);
    const start = nodes[i + 1]?.position?.start.line;
    return end !== undefined && start !== undefined && start - end > 1;
  });
}

/**
 * micromark counts the blank line in front of a blockquote or another list
 * as part of the list before it when both sit in a container, so
 * `> * a\n>\n> > b` comes back loose. Looseness is read from source lines as
 * CommonMark defines it: a blank line between items or between the children
 * of an item.
 */
function isLoose(list: List): boolean {
  if (!list.position) {
    return (
      list.spread === true || list.children.some((item) => item.spread === true)
    );
  }
  return (
    hasBlankLineBetween(list.children) ||
    list.children.some((item) => hasBlankLineBetween(item.children))
  );
}

/**
 * mdast-util-gfm-task-list-item 2.0.0 adds the checkbox only after `*`, `+`,
 * `-`, or `1.`, so a task item printed with a `1)` marker lost it. This adds
 * it after `1)` the same way.
 */
function taskListItemToMarkdown(): ReturnType<
  typeof gfmTaskListItemToMarkdown
> {
  const extension = gfmTaskListItemToMarkdown();
  const listItem = extension.handlers?.listItem;
  if (!listItem) return extension;
  return {
    ...extension,
    handlers: {
      ...extension.handlers,
      listItem(node, parent, state, info) {
        const value = listItem(node, parent, state, info);
        if (
          typeof node.checked !== "boolean" ||
          node.children[0]?.type !== "paragraph"
        ) {
          return value;
        }
        const checkbox = node.checked ? "[x] " : "[ ] ";
        return value.replace(
          /^\d+\)(?:[\r\n]| {1,3})/,
          (marker) => marker + checkbox,
        );
      },
    },
  };
}

function listItemToBlock(
  item: ListItem,
  context: MarkdownCodecContext,
): BlockNode {
  const content = context.toBlocks(item.children);
  const [first, ...rest] = content;
  // A plain item that opens with a list item is the wrapper
  // `listItemFromBlock` prints around a tagged one.
  if (item.checked == null && first?.type === BLOCK_TYPES.listItem) {
    return { ...first, content: [...(first.content ?? []), ...rest] };
  }
  return block(
    context,
    BLOCK_TYPES.listItem,
    { checked: item.checked ?? null },
    { content },
  );
}

function rowToBlock(row: TableRow, context: MarkdownCodecContext): BlockNode {
  return block(
    context,
    BLOCK_TYPES.tableRow,
    {},
    {
      content: row.children.map((cell) =>
        block(
          context,
          BLOCK_TYPES.tableCell,
          {},
          { inline: context.toInline(cell.children) },
        ),
      ),
    },
  );
}

function toBlock(
  node: RootContent,
  context: MarkdownCodecContext,
): BlockNode | undefined {
  switch (node.type) {
    case "heading":
      return block(
        context,
        BLOCK_TYPES.heading,
        { depth: node.depth },
        { inline: context.toInline(node.children) },
      );
    case "list":
      return block(
        context,
        BLOCK_TYPES.list,
        {
          ordered: node.ordered === true,
          start: node.ordered === true ? (node.start ?? 1) : null,
          spread: isLoose(node),
        },
        {
          content: node.children.map((item) => listItemToBlock(item, context)),
        },
      );
    case "listItem":
      return listItemToBlock(node, context);
    case "blockquote":
      return block(
        context,
        BLOCK_TYPES.blockquote,
        {},
        { content: context.toBlocks(node.children) },
      );
    case "code":
      return block(context, BLOCK_TYPES.code, {
        lang: node.lang ?? null,
        meta: node.meta ?? null,
        value: node.value,
      });
    case "table":
      return block(
        context,
        BLOCK_TYPES.table,
        { align: (node.align ?? []).map((align) => align ?? null) },
        { content: node.children.map((row) => rowToBlock(row, context)) },
      );
    case "tableRow":
      return rowToBlock(node, context);
    case "thematicBreak":
      return block(context, BLOCK_TYPES.thematicBreak, {});
    default:
      return undefined;
  }
}
function listFromBlock(
  node: BlockNode,
  context: MarkdownCodecContext,
): RootContent {
  const { ordered, start, spread } = parseListAttrs(node.attrs);
  const items = context.fromBlocks(node.content ?? []).map((child): ListItem =>
    child.type === "listItem"
      ? { ...child, spread }
      : // A foreign block inside a list still needs an item to live in.
        ({
          type: "listItem",
          spread,
          checked: null,
          children: [child],
        } as ListItem),
  );
  return { type: "list", ordered, start, spread, children: items };
}

/**
 * A checkbox only marks a task in front of a paragraph. When the first
 * paragraph has no Markdown form and prints as a tag, the item and that
 * paragraph print as one tag inside a plain item, and the other children
 * follow it so blank lines between them still show the item is loose.
 */
function listItemFromBlock(
  node: BlockNode,
  context: MarkdownCodecContext,
): ListItem {
  const { checked } = parseListItemAttrs(node.attrs);
  const [first, ...rest] = node.content ?? [];
  const children = context.fromBlocks(node.content ?? []);
  if (first && checked !== null && children[0]?.type !== "paragraph") {
    return {
      type: "listItem",
      spread: false,
      checked: null,
      children: [
        context.toGeneric({ ...node, content: [first] }),
        ...context.fromBlocks(rest),
      ] as ListItem["children"],
    };
  }
  return {
    type: "listItem",
    spread: false,
    checked,
    children: children as ListItem["children"],
  };
}

function rowFromBlock(row: BlockNode, context: MarkdownCodecContext): TableRow {
  return {
    type: "tableRow",
    children: (row.content ?? []).map((cell): TableCell => ({
      type: "tableCell",
      children: context.fromInline(cell.inline ?? []),
    })),
  };
}

function fromBlock(
  node: BlockNode,
  context: MarkdownCodecContext,
): RootContent {
  switch (node.type) {
    case BLOCK_TYPES.heading:
      return {
        type: "heading",
        depth: parseHeadingAttrs(node.attrs).depth,
        children: context.fromInline(node.inline ?? []),
      };
    case BLOCK_TYPES.list:
      return listFromBlock(node, context);
    case BLOCK_TYPES.listItem:
      return listItemFromBlock(node, context);
    case BLOCK_TYPES.blockquote:
      return {
        type: "blockquote",
        children: context.fromBlocks(
          node.content ?? [],
        ) as Blockquote["children"],
      };
    case BLOCK_TYPES.code: {
      const { lang, meta, value } = parseCodeAttrs(node.attrs);
      return { type: "code", lang, meta, value };
    }
    case BLOCK_TYPES.table:
      return {
        type: "table",
        align: [...parseTableAttrs(node.attrs).align],
        children: (node.content ?? []).map((row) => rowFromBlock(row, context)),
      };
    case BLOCK_TYPES.tableRow:
      return rowFromBlock(node, context);
    case BLOCK_TYPES.thematicBreak:
      return { type: "thematicBreak" };
    default:
      throw new DocleusError(
        "commonmark/unknown-block",
        `${PLUGIN_NAME} cannot write block type ${node.type}`,
      );
  }
}

function toInline(node: PhrasingContent): InlineNode | undefined {
  switch (node.type) {
    case "image":
      return {
        type: INLINE_TYPES.image,
        attrs: {
          src: node.url,
          alt: node.alt ?? "",
          ...(typeof node.title === "string" && { title: node.title }),
        },
      };
    case "break":
      return { type: INLINE_TYPES.break };
    default:
      return undefined;
  }
}

function fromInline(node: InlineNode): PhrasingContent {
  switch (node.type) {
    case INLINE_TYPES.image: {
      const { src, alt, title } = parseImageAttrs(node.attrs ?? {});
      return { type: "image", url: src, alt, title: title ?? null };
    }
    case INLINE_TYPES.break:
      return { type: "break" };
    default:
      throw new DocleusError(
        "commonmark/unknown-inline",
        `${PLUGIN_NAME} cannot write inline type ${node.type}`,
      );
  }
}

/**
 * The Markdown codec for CommonMark blocks plus GFM tables and task lists.
 * Images and hard breaks are inline types; everything else is a block.
 */
export function createCommonmarkCodec(): MarkdownCodec {
  return {
    name: "commonmark",
    claims: [
      "heading",
      "list",
      "listItem",
      "blockquote",
      "code",
      "table",
      "tableRow",
      "tableCell",
      "thematicBreak",
      "image",
      "break",
    ],
    syntax: {
      micromark: [gfmTable(), gfmTaskListItem()],
      fromMarkdown: [gfmTableFromMarkdown(), gfmTaskListItemFromMarkdown()],
      toMarkdown: [gfmTableToMarkdown(), taskListItemToMarkdown()],
    },
    blockTypes: Object.values(BLOCK_TYPES),
    inlineTypes: Object.values(INLINE_TYPES),
    toBlock,
    fromBlock,
    toInline,
    fromInline,
  };
}
