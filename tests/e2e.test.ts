import {
  definePlugin,
  escapeHtml,
  type BlockNode,
  type MarkdownCodec,
} from "@docleus/sdk";
import { createMarkdownRoundTrip } from "@docleus/testing";
import type { RootContent } from "mdast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BLOCK_TYPES, createCommonmarkCodec } from "../src/shared/index.ts";
import { loadPlugin, type Instance } from "./instance.ts";

const CALLOUT = "test.callout";

/** A minimal container directive node; mdast types it only with mdast-util-directive. */
interface ContainerDirective {
  readonly type: "containerDirective";
  readonly name: string;
  readonly attributes?: Record<string, string | null | undefined> | null;
  readonly children: RootContent[];
}

const calloutCodec: MarkdownCodec = {
  name: "test.callout-codec",
  claims: ["directive:callout"],
  blockTypes: [CALLOUT],
  toBlock(node, context) {
    // Directive node types come from mdast-util-directive's augmentation, which this package does not load.
    const type: string = node.type;
    if (type !== "containerDirective") return undefined;
    const directive = node as unknown as ContainerDirective;
    if (directive.name !== "callout") return undefined;
    return {
      id: context.newId(),
      type: CALLOUT,
      v: 1,
      attrs: { tone: directive.attributes?.tone ?? "info" },
      content: context.toBlocks(directive.children),
    };
  },
  fromBlock(block, context) {
    const directive: ContainerDirective = {
      type: "containerDirective",
      name: "callout",
      attributes: { tone: String(block.attrs.tone) },
      children: context.fromBlocks(block.content ?? []),
    };
    return directive as unknown as RootContent;
  },
};

/** A block type that lives entirely outside core, as a third-party plugin would ship it. */
const callout = definePlugin({
  name: "test-callout",
  inject: ["blocks", "markdown", "render"],
  apply(ctx) {
    ctx.blocks.register(CALLOUT, { version: 1, migrations: {} });
    ctx.markdown.register(calloutCodec);
    ctx.render.registerBlock(CALLOUT, (node, context) => {
      const inner = context.children(node);
      return {
        html: `<aside data-tone="${escapeHtml(String(node.attrs.tone))}">${inner.html}</aside>`,
        islands: inner.islands,
      };
    });
  },
});

const DOCUMENT =
  '# Guide\n\n:::callout{tone="warn"}\nCareful:\n\n- one\n- [x] two\n:::\n\n| a | b |\n| - | - |\n| 1 | 2 |\n';

describe("a block type added without core changes", () => {
  let instance: Instance;

  beforeEach(async () => {
    instance = await loadPlugin();
  });

  afterEach(async () => {
    await instance.dispose();
  });

  const renderAll = (blocks: readonly BlockNode[]) =>
    blocks.map((block) => instance.root.render.render(block).html).join("\n");

  it("parses, renders and exports alongside CommonMark blocks", async () => {
    await instance.root.plugin(callout);
    const document = instance.root.markdown.parse(DOCUMENT);
    const blocks = document.body.content ?? [];
    expect(blocks.map((block) => block.type)).toEqual([
      BLOCK_TYPES.heading,
      CALLOUT,
      BLOCK_TYPES.table,
    ]);
    expect(renderAll(blocks)).toMatchSnapshot();
    expect(instance.root.markdown.serialize(document)).toBe(DOCUMENT);
  });

  it("degrades to a placeholder and keeps its Markdown once unloaded", async () => {
    const fiber = await instance.root.plugin(callout);
    const document = instance.root.markdown.parse(DOCUMENT);
    await fiber.dispose();
    const blocks = document.body.content ?? [];
    expect(renderAll(blocks)).toContain(
      `<div data-unknown-block="${CALLOUT}"></div>`,
    );
    const [, block] = blocks;
    expect(block?.type).toBe(CALLOUT);
    if (block) {
      expect(
        createMarkdownRoundTrip([
          createCommonmarkCodec(),
          calloutCodec,
        ]).survivesUninstall(block),
      ).toContain(`type="${CALLOUT}"`);
    }
  });
});
