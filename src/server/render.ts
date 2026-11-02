import {
  escapeHtml,
  type BlockNode,
  type BlockRenderer,
  type InlineNode,
  type Mark,
  type RenderContext,
  type RenderResult,
} from "@docleus/sdk";
import {
  parseCodeAttrs,
  parseHeadingAttrs,
  parseImageAttrs,
  parseListAttrs,
  parseListItemAttrs,
  parseTableAttrs,
} from "../shared/attrs.ts";
import { BLOCK_TYPES, INLINE_TYPES, type Align } from "../shared/types.ts";
import { safeImageUrl, safeLinkUrl } from "../shared/url.ts";

/** Core marks, outermost first; the order core's printer nests them in. */
const MARK_ORDER = ["link", "strike", "bold", "italic", "code"];

const html = (
  markup: string,
  inner?: Pick<RenderResult, "islands" | "outline">,
): RenderResult => ({
  html: markup,
  islands: inner?.islands ?? [],
  ...(inner?.outline && inner.outline.length > 0 && { outline: inner.outline }),
});

const attr = (name: string, value: string): string =>
  ` ${name}="${escapeHtml(value)}"`;

function wrapMark(mark: Mark, inner: string): string {
  switch (mark.type) {
    case "link": {
      const href =
        typeof mark.attrs?.href === "string"
          ? safeLinkUrl(mark.attrs.href)
          : undefined;
      const title =
        typeof mark.attrs?.title === "string" ? mark.attrs.title : undefined;
      return `<a${href === undefined ? "" : attr("href", href)}${title === undefined ? "" : attr("title", title)}>${inner}</a>`;
    }
    case "strike":
      return `<del>${inner}</del>`;
    case "bold":
      return `<strong>${inner}</strong>`;
    case "italic":
      return `<em>${inner}</em>`;
    case "code":
      return `<code>${inner}</code>`;
    default:
      return inner;
  }
}

function inlineBody(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.text ?? "");
    case "raw":
      return escapeHtml(
        typeof node.attrs?.source === "string" ? node.attrs.source : "",
      );
    case INLINE_TYPES.break:
      return "<br>";
    case INLINE_TYPES.image: {
      const { src, alt, title } = parseImageAttrs(node.attrs ?? {});
      const safe = safeImageUrl(src);
      return `<img${safe === undefined ? "" : attr("src", safe)}${attr("alt", alt)}${title === undefined ? "" : attr("title", title)}>`;
    }
    default:
      return `<span${attr("data-unknown-inline", node.type)}>${escapeHtml(node.text ?? "")}${renderInline(node.content ?? [])}</span>`;
  }
}

/** Renders inline nodes to HTML. Marks nest in core's printing order. */
export function renderInline(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) =>
      (node.marks ?? [])
        .toSorted(
          (a, b) => MARK_ORDER.indexOf(b.type) - MARK_ORDER.indexOf(a.type),
        )
        .reduce((inner, mark) => wrapMark(mark, inner), inlineBody(node)),
    )
    .join("");
}

/** The text of inline nodes without markup, as a heading's outline shows it. */
function plainText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.text ?? "";
        case "raw":
          return typeof node.attrs?.source === "string"
            ? node.attrs.source
            : "";
        case INLINE_TYPES.break:
          return " ";
        case INLINE_TYPES.image:
          return parseImageAttrs(node.attrs ?? {}).alt;
        default:
          return `${node.text ?? ""}${plainText(node.content ?? [])}`;
      }
    })
    .join("");
}

const inlineBlock =
  (tag: string): BlockRenderer =>
  (node) =>
    html(`<${tag}>${renderInline(node.inline ?? [])}</${tag}>`);

const container =
  (tag: string): BlockRenderer =>
  (node, context) => {
    const inner = context.children(node);
    return html(`<${tag}>${inner.html}</${tag}>`, inner);
  };

function concat(results: readonly RenderResult[]): RenderResult {
  return html(results.map((result) => result.html).join(""), {
    islands: results.flatMap((result) => result.islands),
    outline: results.flatMap((result) => result.outline ?? []),
  });
}

function renderItem(
  item: BlockNode,
  context: RenderContext,
  isTight: boolean,
): RenderResult {
  const { checked } =
    item.type === BLOCK_TYPES.listItem
      ? parseListItemAttrs(item.attrs)
      : { checked: null };
  const children =
    item.type === BLOCK_TYPES.listItem ? (item.content ?? []) : [item];
  // A tight list shows its paragraphs without <p>, as CommonMark specifies.
  const inner = concat(
    children.map((child) =>
      isTight && child.type === "paragraph"
        ? html(renderInline(child.inline ?? []))
        : context.children({ ...item, content: [child] }),
    ),
  );
  const box =
    checked === null
      ? ""
      : `<input type="checkbox" disabled${checked ? " checked" : ""}> `;
  const open = checked === null ? "<li>" : '<li class="task-list-item">';
  return html(`${open}${box}${inner.html}</li>`, inner);
}

const renderList: BlockRenderer = (node, context) => {
  const { ordered, start, spread } = parseListAttrs(node.attrs);
  const items = concat(
    (node.content ?? []).map((item) => renderItem(item, context, !spread)),
  );
  const open = ordered
    ? `<ol${start === null || start === 1 ? "" : attr("start", String(start))}>`
    : "<ul>";
  return html(`${open}${items.html}${ordered ? "</ol>" : "</ul>"}`, items);
};

const alignStyle = (align: Align | undefined): string =>
  align ? attr("style", `text-align: ${align}`) : "";

function renderRow(
  row: BlockNode,
  cellTag: "th" | "td",
  align: readonly Align[],
): string {
  const cells = (row.content ?? []).map(
    (cell, index) =>
      `<${cellTag}${alignStyle(align[index])}>${renderInline(cell.inline ?? [])}</${cellTag}>`,
  );
  return `<tr>${cells.join("")}</tr>`;
}

const renderTable: BlockRenderer = (node) => {
  const { align } = parseTableAttrs(node.attrs);
  const [head, ...body] = node.content ?? [];
  const thead = head ? `<thead>${renderRow(head, "th", align)}</thead>` : "";
  const tbody =
    body.length > 0
      ? `<tbody>${body.map((row) => renderRow(row, "td", align)).join("")}</tbody>`
      : "";
  return html(`<table>${thead}${tbody}</table>`);
};

const renderCode: BlockRenderer = (node) => {
  const { lang, value } = parseCodeAttrs(node.attrs);
  const className =
    lang === null ? "" : attr("class", `language-${lang.split(/\s/, 1)[0]}`);
  return html(`<pre><code${className}>${escapeHtml(value)}</code></pre>`);
};

const renderRaw: BlockRenderer = (node) =>
  html(
    `<pre data-raw-block>${escapeHtml(typeof node.attrs.source === "string" ? node.attrs.source : "")}</pre>`,
  );

const renderHeading: BlockRenderer = (node, context) => {
  const { depth } = parseHeadingAttrs(node.attrs);
  const inline = node.inline ?? [];
  const text = plainText(inline);
  const anchor = context.anchor(text);
  return html(
    `<h${depth}${attr("id", anchor)}>${renderInline(inline)}</h${depth}>`,
    { islands: [], outline: [{ anchor, depth, text }] },
  );
};

/**
 * Server renderers by block type. `paragraph` and `raw` are core block
 * types, but core ships no renderer for them, so this plugin provides one.
 */
export const RENDERERS: Readonly<Record<string, BlockRenderer>> = {
  paragraph: inlineBlock("p"),
  raw: renderRaw,
  [BLOCK_TYPES.heading]: renderHeading,
  [BLOCK_TYPES.list]: renderList,
  [BLOCK_TYPES.listItem]: (node, context) => renderItem(node, context, false),
  [BLOCK_TYPES.blockquote]: container("blockquote"),
  [BLOCK_TYPES.code]: renderCode,
  [BLOCK_TYPES.table]: renderTable,
  [BLOCK_TYPES.tableRow]: (node) => html(renderRow(node, "td", [])),
  [BLOCK_TYPES.tableCell]: inlineBlock("td"),
  [BLOCK_TYPES.thematicBreak]: () => html("<hr>"),
};
