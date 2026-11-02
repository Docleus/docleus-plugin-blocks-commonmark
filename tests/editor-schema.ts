import {
  editorNodeName,
  PASSTHROUGH_BLOCK,
  PASSTHROUGH_INLINE,
  type EditorJsonNode,
  type EditorSchemaInfo,
} from "@docleus/sdk";
import { BLOCK_DEFINITIONS, INLINE_DEFINITIONS } from "../src/editor/index.ts";

const keysOf = (attrs: object | undefined) => new Set(Object.keys(attrs ?? {}));

/** The editor schema of the core nodes and marks plus this plugin's types. */
export function commonmarkSchemaInfo(): EditorSchemaInfo {
  const nodes = new Map<string, ReadonlySet<string>>([
    ["doc", new Set()],
    ["paragraph", new Set()],
    ["text", new Set()],
  ]);
  for (const definition of [...BLOCK_DEFINITIONS, ...INLINE_DEFINITIONS]) {
    nodes.set(editorNodeName(definition.type), keysOf(definition.attrs));
  }
  const marks = new Map<string, ReadonlySet<string>>([
    ["bold", new Set()],
    ["italic", new Set()],
    ["strike", new Set()],
    ["code", new Set()],
    ["link", new Set(["href", "title"])],
  ]);
  return {
    nodeAttrs: (name) => nodes.get(name),
    markAttrs: (name) => marks.get(name),
  };
}

/** The types of the blocks and inline nodes that became passthrough nodes. */
export function passthroughTypes(node: EditorJsonNode): unknown[] {
  const kept =
    node.type === PASSTHROUGH_BLOCK
      ? node.attrs?.block
      : node.type === PASSTHROUGH_INLINE
        ? node.attrs?.inline
        : undefined;
  const own =
    typeof kept === "object" && kept !== null && "type" in kept
      ? [kept.type]
      : [];
  return [...own, ...(node.content ?? []).flatMap(passthroughTypes)];
}
