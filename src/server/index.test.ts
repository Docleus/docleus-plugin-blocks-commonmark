import type {
  BlockNode,
  InlineNode,
  RenderContext,
  RenderResult,
} from "@docleus/sdk";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, INLINE_TYPES } from "../shared/index.ts";
import { RENDERERS, renderInline, safeImageUrl, safeLinkUrl } from "./index.ts";

/** Like core's slugger: lowercase, dashes, and `-2`, `-3` for repeats. */
function createAnchor(): RenderContext["anchor"] {
  const taken = new Set<string>();
  return (value) => {
    const base =
      value
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "section";
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  };
}

/** Renders `root` the way core does, with one anchor scope per render. */
function render(root: BlockNode): RenderResult {
  const context: RenderContext = {
    children(parent) {
      const results = (parent.content ?? []).map(renderNode);
      const outline = results.flatMap((result) => result.outline ?? []);
      return {
        html: results.map((result) => result.html).join(""),
        islands: results.flatMap((result) => result.islands),
        ...(outline.length > 0 && { outline }),
      };
    },
    anchor: createAnchor(),
  };
  function renderNode(node: BlockNode): RenderResult {
    if (node.type === "test.doc") return context.children(node);
    const renderer = RENDERERS[node.type];
    if (!renderer) {
      return {
        html: `<div data-unknown-block="${node.type}"></div>`,
        islands: [],
      };
    }
    return renderer(node, context);
  }
  return renderNode(root);
}

const html = (node: BlockNode): string => render(node).html;

const node = (
  type: string,
  attrs: Record<string, unknown> = {},
  children: { content?: BlockNode[]; inline?: InlineNode[] } = {},
): BlockNode => ({ id: "x", type, v: 1, attrs, ...children });

const text = (value: string, marks?: InlineNode["marks"]): InlineNode =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };

const paragraph = (value: string): BlockNode =>
  node("paragraph", {}, { inline: [text(value)] });

const item = (checked: boolean | null, ...content: BlockNode[]): BlockNode =>
  node(BLOCK_TYPES.listItem, { checked }, { content });

const list = (
  attrs: { ordered: boolean; start: number | null; spread: boolean },
  ...content: BlockNode[]
): BlockNode => node(BLOCK_TYPES.list, attrs, { content });

describe("safeLinkUrl", () => {
  it.each([
    "https://example.com",
    "http://example.com",
    "mailto:a@b.c",
    "tel:+1",
    "/docs/a.md",
    "#anchor",
    "relative/path",
    "?q=1",
  ])("keeps %s", (url) => {
    expect(safeLinkUrl(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "java\nscript:alert(1)",
    " javascript:alert(1)",
    "\u0000javascript:alert(1)",
    "vbscript:x",
    "data:text/html,<b>x</b>",
    "file:///etc/passwd",
  ])("drops %j", (url) => {
    expect(safeLinkUrl(url)).toBeUndefined();
  });
});

describe("safeImageUrl", () => {
  it.each([
    "img.png",
    "/a/b.png",
    "https://example.com/x.png",
    "data:image/png;base64,AAAA",
  ])("keeps %s", (url) => {
    expect(safeImageUrl(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<b>x</b>",
    "mailto:a@b.c",
  ])("drops %j", (url) => {
    expect(safeImageUrl(url)).toBeUndefined();
  });
});

describe("renderInline", () => {
  it("escapes text", () => {
    expect(renderInline([text("<script>\"&'")])).toBe(
      "&lt;script&gt;&quot;&amp;&#39;",
    );
  });

  it("nests marks in core's order whatever order they are stored in", () => {
    const expected =
      '<a href="/x"><del><strong><em><code>t</code></em></strong></del></a>';
    const link = { type: "link", attrs: { href: "/x" } };
    expect(
      renderInline([
        text("t", [
          { type: "code" },
          { type: "italic" },
          link,
          { type: "bold" },
          { type: "strike" },
        ]),
      ]),
    ).toBe(expected);
    expect(
      renderInline([
        text("t", [
          link,
          { type: "strike" },
          { type: "bold" },
          { type: "italic" },
          { type: "code" },
        ]),
      ]),
    ).toBe(expected);
  });

  it("renders link titles and drops unsafe hrefs", () => {
    expect(
      renderInline([
        text("a", [
          { type: "link", attrs: { href: "https://e.x/?a=1&b", title: '"t"' } },
        ]),
      ]),
    ).toBe('<a href="https://e.x/?a=1&amp;b" title="&quot;t&quot;">a</a>');
    expect(
      renderInline([
        text("a", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
      ]),
    ).toBe("<a>a</a>");
  });

  it("passes unknown marks through", () => {
    expect(
      renderInline([text("a", [{ type: "acme.highlight" }, { type: "bold" }])]),
    ).toBe("<strong>a</strong>");
  });

  it("renders images and breaks", () => {
    expect(
      renderInline([
        {
          type: INLINE_TYPES.image,
          attrs: { src: "a b.png", alt: 'x"y', title: "t" },
        },
        { type: INLINE_TYPES.break },
        {
          type: INLINE_TYPES.image,
          attrs: { src: "javascript:alert(1)", alt: "" },
        },
      ]),
    ).toBe('<img src="a b.png" alt="x&quot;y" title="t"><br><img alt="">');
  });

  it("shows raw inline source escaped", () => {
    expect(renderInline([{ type: "raw", attrs: { source: "<kbd>" } }])).toBe(
      "&lt;kbd&gt;",
    );
  });

  it("keeps the text of unknown inline nodes", () => {
    expect(
      renderInline([
        {
          type: "acme.mention",
          text: "@a<",
          content: [text("b", [{ type: "bold" }])],
        },
      ]),
    ).toBe(
      '<span data-unknown-inline="acme.mention">@a&lt;<strong>b</strong></span>',
    );
  });
});

describe("block renderers", () => {
  it("render paragraphs and headings", () => {
    expect(html(paragraph("a < b"))).toBe("<p>a &lt; b</p>");
    expect(
      html(node(BLOCK_TYPES.heading, { depth: 3 }, { inline: [text("T")] })),
    ).toBe('<h3 id="t">T</h3>');
  });

  it("render tight lists without paragraph tags", () => {
    expect(
      html(
        list(
          { ordered: false, start: null, spread: false },
          item(null, paragraph("a")),
          item(
            null,
            paragraph("b"),
            list(
              { ordered: true, start: 1, spread: false },
              item(null, paragraph("c")),
            ),
          ),
        ),
      ),
    ).toBe("<ul><li>a</li><li>b<ol><li>c</li></ol></li></ul>");
  });

  it("render loose lists with paragraph tags", () => {
    expect(
      html(
        list(
          { ordered: true, start: 3, spread: true },
          item(null, paragraph("a")),
          item(null, paragraph("b")),
        ),
      ),
    ).toBe('<ol start="3"><li><p>a</p></li><li><p>b</p></li></ol>');
  });

  it("omit the start of ordered lists that begin at 1", () => {
    expect(
      html(
        list(
          { ordered: true, start: 1, spread: false },
          item(null, paragraph("a")),
        ),
      ),
    ).toBe("<ol><li>a</li></ol>");
  });

  it("render task items with disabled checkboxes", () => {
    expect(
      html(
        list(
          { ordered: false, start: null, spread: false },
          item(true, paragraph("done")),
          item(false, paragraph("todo")),
        ),
      ),
    ).toBe(
      '<ul><li class="task-list-item"><input type="checkbox" disabled checked> done</li>' +
        '<li class="task-list-item"><input type="checkbox" disabled> todo</li></ul>',
    );
  });

  it("wrap foreign blocks inside a list in an item", () => {
    expect(
      html(
        list(
          { ordered: false, start: null, spread: false },
          node("acme.widget"),
        ),
      ),
    ).toBe('<ul><li><div data-unknown-block="acme.widget"></div></li></ul>');
  });

  it("render blockquotes, code and rules", () => {
    expect(
      html(node(BLOCK_TYPES.blockquote, {}, { content: [paragraph("q")] })),
    ).toBe("<blockquote><p>q</p></blockquote>");
    expect(
      html(
        node(BLOCK_TYPES.code, {
          lang: "ts",
          meta: "title=a",
          value: "a < b\n",
        }),
      ),
    ).toBe('<pre><code class="language-ts">a &lt; b\n</code></pre>');
    expect(
      html(node(BLOCK_TYPES.code, { lang: null, meta: null, value: "x" })),
    ).toBe("<pre><code>x</code></pre>");
    expect(html(node(BLOCK_TYPES.thematicBreak))).toBe("<hr>");
  });

  it("render tables with a header row and alignment", () => {
    const row = (...cells: string[]): BlockNode =>
      node(
        BLOCK_TYPES.tableRow,
        {},
        {
          content: cells.map((cell) =>
            node(BLOCK_TYPES.tableCell, {}, { inline: [text(cell)] }),
          ),
        },
      );
    expect(
      html(
        node(
          BLOCK_TYPES.table,
          { align: ["left", null, "center"] },
          { content: [row("a", "b", "c"), row("1", "2", "3")] },
        ),
      ),
    ).toBe(
      '<table><thead><tr><th style="text-align: left">a</th><th>b</th><th style="text-align: center">c</th></tr></thead>' +
        '<tbody><tr><td style="text-align: left">1</td><td>2</td><td style="text-align: center">3</td></tr></tbody></table>',
    );
    expect(
      html(node(BLOCK_TYPES.table, { align: [null] }, { content: [row("h")] })),
    ).toBe("<table><thead><tr><th>h</th></tr></thead></table>");
  });

  it("show raw blocks as escaped source", () => {
    expect(html(node("raw", { source: "<div>x</div>" }))).toBe(
      "<pre data-raw-block>&lt;div&gt;x&lt;/div&gt;</pre>",
    );
  });

  it("pass islands of child blocks through", () => {
    const island = { blockId: "i", type: "acme.island" };
    const inner: RenderContext = {
      children: () => ({ html: "<i></i>", islands: [island] }),
      anchor: createAnchor(),
    };
    const result = RENDERERS[BLOCK_TYPES.blockquote]?.(
      node(BLOCK_TYPES.blockquote, {}, { content: [paragraph("q")] }),
      inner,
    );
    expect(result).toEqual({
      html: "<blockquote><i></i></blockquote>",
      islands: [island],
    });
  });

  it("reject invalid attrs", () => {
    expect(() => html(node(BLOCK_TYPES.heading, { depth: 9 }))).toThrow(
      expect.objectContaining({ code: "commonmark/invalid-attrs" }),
    );
  });
});

const heading = (depth: number, ...inline: InlineNode[]): BlockNode =>
  node(BLOCK_TYPES.heading, { depth }, { inline });
const doc = (...content: BlockNode[]): BlockNode =>
  node("test.doc", {}, { content });

describe("heading anchors", () => {
  it("give duplicate headings unique ids", () => {
    expect(
      html(
        doc(
          heading(2, text("Usage")),
          heading(2, text("Usage")),
          heading(3, text("Usage")),
        ),
      ),
    ).toBe(
      '<h2 id="usage">Usage</h2><h2 id="usage-2">Usage</h2><h3 id="usage-3">Usage</h3>',
    );
  });

  it("list headings in document order with their depth, also inside containers", () => {
    const result = render(
      doc(
        heading(1, text("Intro")),
        node(
          BLOCK_TYPES.blockquote,
          {},
          { content: [heading(3, text("Quoted"))] },
        ),
        list(
          { ordered: false, start: null, spread: false },
          item(null, heading(4, text("In a list"))),
          item(true, paragraph("task"), heading(5, text("In a task"))),
        ),
        list(
          { ordered: true, start: 1, spread: true },
          item(null, heading(6, text("Loose"))),
        ),
        heading(2, text("End")),
      ),
    );
    expect(result.outline).toEqual([
      { anchor: "intro", depth: 1, text: "Intro" },
      { anchor: "quoted", depth: 3, text: "Quoted" },
      { anchor: "in-a-list", depth: 4, text: "In a list" },
      { anchor: "in-a-task", depth: 5, text: "In a task" },
      { anchor: "loose", depth: 6, text: "Loose" },
      { anchor: "end", depth: 2, text: "End" },
    ]);
  });

  it("use the plain text of marks, links, code and other inline nodes", () => {
    const result = render(
      heading(
        2,
        text("Use "),
        text("bold", [{ type: "bold" }]),
        text(" "),
        text("<code>", [{ type: "code" }]),
        text(" & "),
        text("a link", [{ type: "link", attrs: { href: "/x" } }]),
        { type: INLINE_TYPES.break },
        { type: INLINE_TYPES.image, attrs: { src: "i.png", alt: "pic" } },
        { type: "raw", attrs: { source: "<kbd>" } },
        { type: "acme.mention", text: "@a", content: [text("b")] },
      ),
    );
    const plain = "Use bold <code> & a link pic<kbd>@ab";
    expect(result.outline).toEqual([
      { anchor: "use-bold-code-a-link-pic-kbd-ab", depth: 2, text: plain },
    ]);
    expect(result.html).toMatch(/^<h2 id="use-bold-code-a-link-pic-kbd-ab">/);
  });

  it("escape the anchor", () => {
    const context: RenderContext = {
      children: () => ({ html: "", islands: [] }),
      anchor: () => '"><script>',
    };
    expect(
      RENDERERS[BLOCK_TYPES.heading]?.(heading(1, text("x")), context).html,
    ).toBe('<h1 id="&quot;&gt;&lt;script&gt;">x</h1>');
  });

  it("leave results without headings without an outline", () => {
    expect(render(doc(paragraph("a"))).outline).toBeUndefined();
  });
});
