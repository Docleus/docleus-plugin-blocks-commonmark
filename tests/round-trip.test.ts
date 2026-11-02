import { createMarkdownService } from "@docleus/core-markdown";
import {
  Context,
  type BlockNode,
  type InlineNode,
  type Mark,
} from "@docleus/sdk";
import { createMarkdownRoundTrip } from "@docleus/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES,
  INLINE_TYPES,
  createCommonmarkCodec,
  type Align,
} from "../src/shared/index.ts";

const check = createMarkdownRoundTrip([createCommonmarkCodec()]);
const service = createMarkdownService(new Context());
service.register(createCommonmarkCodec());

/** Printable text, weighted towards characters Markdown gives meaning to. */
const SPECIAL = [..."*_`~[]()<>#!:\\&\"'{}|-+.=$%^@/?;,"];
const LETTERS = [..."abcxyzABC019 "];
const textChar = fc.constantFrom(
  ...SPECIAL,
  ...LETTERS.filter((c) => c !== " "),
);
const wordsOf = (unit: fc.Arbitrary<string>) =>
  fc
    .array(fc.string({ unit, minLength: 1, maxLength: 6 }), {
      minLength: 1,
      maxLength: 3,
    })
    .map((list) => list.join(" "));
const words = wordsOf(textChar);

const coreMark = fc.oneof(
  fc.constantFrom<Mark>(
    { type: "bold" },
    { type: "italic" },
    { type: "strike" },
    { type: "code" },
  ),
  fc
    .constantFrom("https://example.com/a", "/docs/b.md", "#c")
    .map((href): Mark => ({ type: "link", attrs: { href } })),
);

const textNodeOf = (textArbitrary: fc.Arbitrary<string>) =>
  fc
    .record({
      text: textArbitrary,
      marks: fc.uniqueArray(coreMark, {
        maxLength: 3,
        selector: (m) => m.type,
      }),
    })
    .map(({ text, marks }): InlineNode =>
      marks.length > 0 ? { type: "text", text, marks } : { type: "text", text },
    );
const textNode = textNodeOf(words);

const image = fc
  .record({
    marks: fc.uniqueArray(coreMark, { maxLength: 2, selector: (m) => m.type }),
    src: fc.constantFrom(
      "img.png",
      "/a/b.png",
      "https://example.com/x.png",
      "a b.png",
    ),
    alt: fc.oneof(words, fc.constant("")),
    title: fc.option(words, { nil: undefined }),
  })
  .map(({ marks, src, alt, title }): InlineNode => ({
    type: INLINE_TYPES.image,
    attrs: title === undefined ? { src, alt } : { src, alt, title },
    ...(marks.length > 0 && { marks }),
  }));

const phrasingOf = (text: fc.Arbitrary<InlineNode>) =>
  fc.array(
    fc.oneof({ weight: 4, arbitrary: text }, { weight: 1, arbitrary: image }),
    { minLength: 1, maxLength: 4 },
  );
const phrasing = phrasingOf(textNode);

/**
 * GFM splits table cells on `|` before it parses inline code, so a `\` in
 * front of an escaped pipe inside code breaks the row. Cells leave pipes out.
 */
const cellPhrasing = phrasingOf(
  textNodeOf(
    wordsOf(fc.constantFrom(...SPECIAL.filter((c) => c !== "|"), "a")),
  ),
);

/** Hard breaks only sit between text: at either end of a line they vanish. */
const withBreaks = fc
  .tuple(phrasing, fc.array(fc.boolean(), { maxLength: 4 }))
  .map(([nodes, breaks]) =>
    nodes.flatMap((node, i): InlineNode[] => {
      const next = nodes[i + 1];
      return breaks[i] === true && node.type === "text" && next?.type === "text"
        ? [node, { type: INLINE_TYPES.break }]
        : [node];
    }),
  );

const block = (
  type: string,
  attrs: Record<string, unknown>,
  children: { content?: BlockNode[]; inline?: InlineNode[] } = {},
): BlockNode => ({ id: "x", type, v: 1, attrs, ...children });

const paragraph = withBreaks.map((inline) =>
  block("paragraph", {}, { inline }),
);
const heading = fc
  .record({ depth: fc.integer({ min: 1, max: 6 }), inline: phrasing })
  .map(({ depth, inline }) =>
    block(BLOCK_TYPES.heading, { depth }, { inline }),
  );
const thematicBreak = fc.constant(block(BLOCK_TYPES.thematicBreak, {}));
const raw = fc.constant(block("raw", { source: "<div>x</div>" }));

const codeChar = fc.constantFrom(...SPECIAL, ...LETTERS, "\n");
const code = fc
  .record({
    lang: fc.option(fc.constantFrom("ts", "js", "python"), { nil: null }),
    meta: fc.option(fc.constantFrom('title="a.ts"', "{1,3}"), { nil: null }),
    value: fc.string({ unit: codeChar, maxLength: 20 }),
  })
  .map(({ lang, meta, value }) =>
    block(BLOCK_TYPES.code, { lang, meta: lang === null ? null : meta, value }),
  );

const ALIGNS: readonly Align[] = ["left", "right", "center", null];
const table = fc
  .array(fc.constantFrom(...ALIGNS), { minLength: 1, maxLength: 3 })
  .chain((align) =>
    fc
      .array(
        fc.array(cellPhrasing, {
          minLength: align.length,
          maxLength: align.length,
        }),
        {
          minLength: 1,
          maxLength: 3,
        },
      )
      .map((rows) =>
        block(
          BLOCK_TYPES.table,
          { align },
          {
            content: rows.map((cells) =>
              block(
                BLOCK_TYPES.tableRow,
                {},
                {
                  content: cells.map((inline) =>
                    block(BLOCK_TYPES.tableCell, {}, { inline }),
                  ),
                },
              ),
            ),
          },
        ),
      ),
  );

const isList = (node: BlockNode | undefined): boolean =>
  node?.type === BLOCK_TYPES.list;

/**
 * Two lists next to each other re-parse as one list when their markers
 * match. Imported documents never contain this, because the parser already
 * joined them.
 */
function hasAdjacentLists(blocks: readonly BlockNode[]): boolean {
  return blocks.some(
    (current, i) =>
      (isList(current) && isList(blocks[i + 1])) ||
      hasAdjacentLists(current.content ?? []),
  );
}

/**
 * In a tight item, children are printed without blank lines between them,
 * so only a paragraph followed by a block that can interrupt it survives.
 */
const isLateOrderedList = (node: BlockNode): boolean =>
  node.type === BLOCK_TYPES.list &&
  node.attrs.ordered === true &&
  node.attrs.start !== 1;

/**
 * micromark 4.0.3 does not let a container opened on the line after a
 * paragraph start with an ordered list other than 1: `* a\n  > 0. b` reads
 * `0. b` as text, although CommonMark parses a list.
 */
const opensWithLateOrderedList = (node: BlockNode | undefined): boolean =>
  node !== undefined &&
  (isLateOrderedList(node) ||
    ((node.type === BLOCK_TYPES.blockquote ||
      node.type === BLOCK_TYPES.list ||
      node.type === BLOCK_TYPES.listItem) &&
      opensWithLateOrderedList(node.content?.[0])));

const canInterruptParagraph = (node: BlockNode): boolean =>
  node.type === BLOCK_TYPES.heading ||
  node.type === BLOCK_TYPES.code ||
  node.type === BLOCK_TYPES.thematicBreak ||
  ((node.type === BLOCK_TYPES.blockquote || node.type === BLOCK_TYPES.list) &&
    !isLateOrderedList(node) &&
    !opensWithLateOrderedList(node.content?.[0]));

const isTightItem = (content: readonly BlockNode[]): boolean =>
  content.length === 1 ||
  (content.length === 2 &&
    content[0]?.type === "paragraph" &&
    content[1] !== undefined &&
    canInterruptParagraph(content[1]));

const { flow } = fc.letrec<{
  flow: BlockNode;
  blockquote: BlockNode;
  list: BlockNode;
}>((tie) => ({
  flow: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    { weight: 4, arbitrary: paragraph },
    { weight: 2, arbitrary: heading },
    { weight: 2, arbitrary: code },
    { weight: 1, arbitrary: thematicBreak },
    { weight: 1, arbitrary: raw },
    { weight: 2, arbitrary: table },
    { weight: 2, arbitrary: tie("blockquote") },
    { weight: 3, arbitrary: tie("list") },
  ),
  blockquote: fc
    .array(tie("flow"), { minLength: 1, maxLength: 3 })
    .map((content) => block(BLOCK_TYPES.blockquote, {}, { content })),
  list: fc
    .record({
      ordered: fc.boolean(),
      start: fc.integer({ min: 0, max: 20 }),
      spread: fc.boolean(),
      items: fc.array(
        fc.record({
          checked: fc.constantFrom(null, true, false),
          content: fc.array(tie("flow"), { minLength: 1, maxLength: 3 }),
        }),
        { minLength: 1, maxLength: 3 },
      ),
    })
    .filter(
      ({ spread, items }) =>
        // A loose list needs a blank line somewhere to stay loose.
        (spread
          ? items.length > 1 || items.some((item) => item.content.length > 1)
          : items.every((item) => isTightItem(item.content))) &&
        // `[ ]` only marks a task in front of a paragraph.
        items.every(
          (item) =>
            item.checked === null || item.content[0]?.type === "paragraph",
        ),
    )
    .map(({ ordered, start, spread, items }) =>
      block(
        BLOCK_TYPES.list,
        { ordered, start: ordered ? start : null, spread },
        {
          content: items.map(({ checked, content }) =>
            block(BLOCK_TYPES.listItem, { checked }, { content }),
          ),
        },
      ),
    ),
}));

const generated = flow.filter((node) => !hasAdjacentLists([node]));

// ROUND_TRIP_RUNS raises the run count for a deeper local search.
const RUNS = Number(process.env.ROUND_TRIP_RUNS ?? 3000);

describe("commonmark round trip", { timeout: 120_000 }, () => {
  it("keeps generated blocks through tree -> Markdown -> tree", () => {
    fc.assert(
      fc.property(generated, (node) => {
        check.roundTrip(node);
      }),
      { numRuns: RUNS },
    );
  });

  it("keeps generated blocks while the plugin is uninstalled", () => {
    fc.assert(
      fc.property(generated, (node) => {
        check.survivesUninstall(node);
      }),
      { numRuns: Math.ceil(RUNS / 3) },
    );
  });

  const listSpreads = (blocks: readonly BlockNode[]): unknown[] =>
    blocks.flatMap((node) => [
      ...(node.type === BLOCK_TYPES.list ? [node.attrs.spread] : []),
      ...listSpreads(node.content ?? []),
    ]);

  it.each([
    ["a list before a nested quote", "> * a\n>\n> > b\n", [false]],
    [
      "a list before a quote in an item",
      "* x\n\n  * a\n\n  > b\n",
      [true, false],
    ],
    ["a list before another list", "> * a\n>\n> - b\n", [false, false]],
    ["items apart", "* a\n\n* b\n", [true]],
    ["item children apart", "* a\n\n  b\n", [true]],
    ["a nested tight list", "* a\n  * b\n\n  c\n", [true, false]],
    ["items apart after a nested list", "* a\n  * b\n\n* c\n", [true, false]],
    [
      "nested lists before a quote",
      "> * a\n>   * b\n>\n> > c\n",
      [false, false],
    ],
    ["an item ending in a quote", "* > a\n  >\n* b\n", [false]],
    ["a blank line inside code", "* ```\n  x\n\n  ```\n", [false]],
  ])("reads looseness of %s as CommonMark does", (_name, markdown, spreads) => {
    expect(listSpreads(service.parse(markdown).body.content ?? [])).toEqual(
      spreads,
    );
  });

  it.each([false, true])(
    "keeps a task item whose first paragraph has no Markdown form (loose: %s)",
    (spread) => {
      // Link text holding `]:` in code reads back as a definition, so the
      // paragraph prints as a generic tag and cannot carry a checkbox.
      const paragraphOf = (inline: InlineNode[]) =>
        block("paragraph", {}, { inline });
      const unprintable = paragraphOf([
        {
          type: "text",
          text: "]:",
          marks: [{ type: "link", attrs: { href: "#c" } }, { type: "code" }],
        },
      ]);
      const b = paragraphOf([{ type: "text", text: "b" }]);
      const list = block(
        BLOCK_TYPES.list,
        { ordered: false, start: null, spread },
        {
          content: [
            block(
              BLOCK_TYPES.listItem,
              { checked: true },
              { content: spread ? [unprintable, b] : [unprintable] },
            ),
            block(BLOCK_TYPES.listItem, { checked: false }, { content: [b] }),
          ],
        },
      );
      expect(check.roundTrip(list)).toMatch(
        /^\* :::block\{type="commonmark\.list-item" /,
      );
    },
  );

  it.each([
    ["heading", "## Title\n"],
    ["bullet list", "* a\n* b\n"],
    ["ordered list", "3. a\n4. b\n"],
    ["task list", "* [x] done\n* [ ] todo\n"],
    ["blockquote", "> quote\n"],
    ["code", "```ts\nconst a = 1;\n```\n"],
    ["image", "![alt](img.png)\n"],
    ["table", "| a  |  b |\n| :- | -: |\n| 1  |  2 |\n"],
    ["thematic break", "***\n"],
    ["task after another ordered list", "> 1. a\n>\n> > 1) [ ] b\n"],
  ])("prints a %s as plain Markdown", (_name, markdown) => {
    const [node] = service.parse(markdown).body.content ?? [];
    expect(node && check.roundTrip(node)).toBe(markdown);
  });
});
