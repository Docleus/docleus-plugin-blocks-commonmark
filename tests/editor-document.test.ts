import { readFileSync } from "node:fs";
import { fromEditorDocument, toEditorDocument } from "@docleus/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commonmarkSchemaInfo, passthroughTypes } from "./editor-schema.ts";
import { loadPlugin, type Instance } from "./instance.ts";

const EVERY_TYPE = [
  "# Heading **bold**",
  "",
  "Text with a hard  ",
  'break and ![alt](img.png "title") and [a link](/x "t").',
  "",
  "* bullet",
  "  * nested",
  "",
  "3. ordered",
  "",
  "- [ ] task",
  "- [x] done",
  "",
  "> quote",
  "",
  "```ts meta",
  "const a = 1;",
  "```",
  "",
  "| a | b |",
  "| :- | -: |",
  "| `c` | d |",
  "",
  "***",
  "",
].join("\n");

let instance: Instance;

beforeEach(async () => {
  instance = await loadPlugin();
});

afterEach(async () => {
  await instance.dispose();
});

describe("editor document", () => {
  it.each([
    ["every type", EVERY_TYPE],
    [
      "the mixed-style fixture",
      readFileSync(new URL("fixtures/mixed-style.md", import.meta.url), "utf8"),
    ],
  ])("shows %s in the editor schema and converts back", (_, markdown) => {
    const { body } = instance.root.markdown.parse(markdown);
    const json = toEditorDocument(body, commonmarkSchemaInfo());
    expect(fromEditorDocument(json)).toEqual(body);
  });

  it("needs passthrough nodes only for blocks it has no editor type for", () => {
    const json = toEditorDocument(
      instance.root.markdown.parse(EVERY_TYPE).body,
      commonmarkSchemaInfo(),
    );
    expect(passthroughTypes(json)).toEqual([]);

    const fixture = toEditorDocument(
      instance.root.markdown.parse(
        readFileSync(
          new URL("fixtures/mixed-style.md", import.meta.url),
          "utf8",
        ),
      ).body,
      commonmarkSchemaInfo(),
    );
    // The fixture also holds blocks of other plugins, which are not loaded.
    expect(new Set(passthroughTypes(fixture))).toEqual(
      new Set(["raw", "acme.callout", "acme.tabs"]),
    );
  });
});
