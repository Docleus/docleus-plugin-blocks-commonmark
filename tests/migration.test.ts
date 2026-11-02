import {
  definePlugin,
  type BlockNode,
  type BlockTypeDefinition,
} from "@docleus/sdk";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { plugin } from "../src/server/index.ts";
import { BLOCK_TYPES } from "../src/shared/index.ts";
import { loadPlugin, type Instance } from "./instance.ts";

const node = (
  type: string,
  v: number,
  attrs: Record<string, unknown>,
  content?: BlockNode[],
): BlockNode => ({ id: "x", type, v, attrs, ...(content && { content }) });

const VERSIONED = "test.versioned";

const versioned = (definition: BlockTypeDefinition) =>
  definePlugin({
    name: "test-versioned",
    inject: ["blocks"],
    apply(ctx) {
      ctx.blocks.register(VERSIONED, definition);
    },
  });

describe("schema versions", () => {
  let instance: Instance;

  beforeEach(async () => {
    instance = await loadPlugin();
  });

  afterEach(async () => {
    await instance.dispose();
  });

  it("reads current CommonMark nodes unchanged", () => {
    const { body } = instance.root.markdown.parse(
      "# T\n\n- [x] a\n\n> q\n\n```ts\nx\n```\n\n|a|\n|-|\n|1|\n\n***\n",
    );
    for (const block of body.content ?? []) {
      expect(instance.root.blocks.read(block)).toEqual(block);
    }
  });

  it("migrates other plugins' blocks nested in CommonMark containers", async () => {
    await instance.root.plugin(
      versioned({
        version: 2,
        migrations: {
          1: (old) => ({ ...old, v: 2, attrs: { label: old.attrs.name } }),
        },
      }),
    );
    const list = node(
      BLOCK_TYPES.list,
      1,
      { ordered: false, start: null, spread: false },
      [
        node(BLOCK_TYPES.listItem, 1, { checked: null }, [
          node(BLOCK_TYPES.blockquote, 1, {}, [
            node(VERSIONED, 1, { name: "a" }),
          ]),
        ]),
      ],
    );
    expect(instance.root.blocks.read(list)).toEqual(
      node(
        BLOCK_TYPES.list,
        1,
        { ordered: false, start: null, spread: false },
        [
          node(BLOCK_TYPES.listItem, 1, { checked: null }, [
            node(BLOCK_TYPES.blockquote, 1, {}, [
              node(VERSIONED, 2, { label: "a" }),
            ]),
          ]),
        ],
      ),
    );
  });

  it("applies every step of a migration chain in order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        async (version, offset) => {
          const start = Math.max(1, version - offset);
          const migrations: Record<number, (old: BlockNode) => BlockNode> = {};
          for (let v = 1; v < version; v++) {
            migrations[v] = (old) => ({
              ...old,
              v: v + 1,
              attrs: { steps: [...(old.attrs.steps as number[]), v] },
            });
          }
          const fiber = await instance.root.plugin(
            versioned({ version, migrations }),
          );
          try {
            const read = instance.root.blocks.read(
              node(VERSIONED, start, { steps: [] }),
            );
            expect(read.v).toBe(version);
            expect(read.attrs.steps).toEqual(
              Array.from({ length: version - start }, (_, i) => start + i),
            );
          } finally {
            await fiber.dispose();
          }
        },
      ),
    );
  });

  it("rejects a chain with a missing step", async () => {
    await instance.root.plugin(
      versioned({ version: 3, migrations: { 2: (old) => old } }),
    );
    expect(() => instance.root.blocks.read(node(VERSIONED, 1, {}))).toThrow(
      expect.objectContaining({ code: "blocks/missing-migration" }),
    );
  });

  it("refuses to load twice because the block types are taken", async () => {
    await expect(instance.root.plugin(plugin)).rejects.toMatchObject({
      code: "blocks/already-registered",
    });
  });
});
