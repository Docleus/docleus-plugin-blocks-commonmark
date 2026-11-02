import { definePlugin } from "@docleus/sdk";
import { PLUGIN_NAME } from "../shared/types.ts";
import { BLOCK_DEFINITIONS, INLINE_DEFINITIONS } from "./definitions.ts";
import { SLASH_ITEMS, TOOLBAR_ITEMS } from "./items.ts";
import { COMMONMARK_EDITOR_CSS } from "./styles.ts";

export { BLOCK_DEFINITIONS, INLINE_DEFINITIONS } from "./definitions.ts";
export { SLASH_ITEMS, TOOLBAR_ITEMS } from "./items.ts";

/**
 * Registers the CommonMark blocks, their toolbar and slash items, and their
 * styles with the editor. Everything is undone when the plugin unloads.
 */
export const plugin = definePlugin({
  name: PLUGIN_NAME,
  inject: ["editor"],
  apply(ctx) {
    for (const definition of BLOCK_DEFINITIONS) {
      ctx.editor.registerBlock(definition);
    }
    for (const definition of INLINE_DEFINITIONS) {
      ctx.editor.registerInline(definition);
    }
    for (const item of TOOLBAR_ITEMS) ctx.editor.registerToolbarItem(item);
    for (const item of SLASH_ITEMS) ctx.editor.registerSlashItem(item);
    ctx.effect(() => {
      const style = document.createElement("style");
      style.dataset.plugin = PLUGIN_NAME;
      style.textContent = COMMONMARK_EDITOR_CSS;
      document.head.append(style);
      return () => style.remove();
    }, "commonmark editor styles");
  },
});
