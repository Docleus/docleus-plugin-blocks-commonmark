import { createBlocksService } from "@docleus/core-blocks";
import { createMarkdownService } from "@docleus/core-markdown";
import { createRenderService } from "@docleus/core-render";
import { Context } from "@docleus/sdk";
import { plugin } from "../src/server/index.ts";

export interface Instance {
  readonly root: Context;
  unloadPlugin(): Promise<void>;
  dispose(): Promise<void>;
}

/** Loads the default core services and this plugin into a fresh context. */
export async function loadPlugin(): Promise<Instance> {
  const root = new Context();
  const core = await root.plugin((ctx: Context) => {
    ctx.provide("blocks", createBlocksService(ctx));
    ctx.provide("markdown", createMarkdownService(ctx));
    ctx.provide("render", createRenderService(ctx));
  });
  const fiber = await root.plugin(plugin);
  return {
    root,
    unloadPlugin: () => fiber.dispose(),
    async dispose() {
      await fiber.dispose();
      await core.dispose();
    },
  };
}
