import { definePlugin, type BlockTypeDefinition } from "@docleus/sdk";
import { createCommonmarkCodec } from "../shared/codec.ts";
import { BLOCK_TYPES, BLOCK_VERSION, PLUGIN_NAME } from "../shared/types.ts";
import { RENDERERS } from "./render.ts";

export { RENDERERS, renderInline } from "./render.ts";
export { safeImageUrl, safeLinkUrl } from "../shared/url.ts";

// Code keeps its text in attrs rather than inline nodes, where
// `ctx.blocks.text` (and so search) would not find it.
const DEFINITIONS: Readonly<Record<string, BlockTypeDefinition>> = {
  [BLOCK_TYPES.code]: {
    version: BLOCK_VERSION,
    text: (node) =>
      typeof node.attrs.value === "string" ? node.attrs.value : "",
  },
};

/**
 * Registers the CommonMark block types, their Markdown codec and their
 * server renderers. Everything is undone when the plugin unloads.
 */
export const plugin = definePlugin({
  name: PLUGIN_NAME,
  inject: ["blocks", "markdown", "render"],
  apply(ctx) {
    for (const type of Object.values(BLOCK_TYPES)) {
      ctx.blocks.register(
        type,
        DEFINITIONS[type] ?? { version: BLOCK_VERSION },
      );
    }
    ctx.markdown.register(createCommonmarkCodec());
    for (const [type, renderer] of Object.entries(RENDERERS)) {
      ctx.render.registerBlock(type, renderer);
    }
  },
});
