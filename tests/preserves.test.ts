import { readFileSync } from "node:fs";
import { createMarkdownService } from "@docleus/core-markdown";
import { Context, type BlockNode } from "@docleus/sdk";
import { createMarkdownRoundTrip } from "@docleus/testing";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, createCommonmarkCodec } from "../src/shared/index.ts";

const check = createMarkdownRoundTrip([createCommonmarkCodec()]);

const SOURCES: Record<string, string> = {
  "unpadded table": "|a|b|\n|:-|-:|\n|1|**2**|\n",
  "table without outer pipes": "a | b\n--- | ---\n1 | `x \\| y`\n",
  "task list": "- [x] done\n- [ ] todo\n  continued\n",
  "mixed markers": "+ a\n+ b\n\n- c\n",
  "loose list": "1. a\n\n   more\n2. b\n",
  "nested quote": "> a\n> > b\n> - c\n",
  "fenced code": "~~~~js  title=x\n```\n~~~~\n",
  "images and breaks": "![a *b*](<a b.png> 'T')  \nnext\\\nlast\n",
  "setext and atx headings": "Title\n---\n\n#  Spaced #\n",
  "thematic breaks": "- - -\n\n___\n",
};

describe("source preservation", () => {
  it.each(Object.entries(SOURCES))(
    "exports an unchanged %s byte for byte",
    (_name, markdown) => {
      check.preserves(markdown);
    },
  );

  it("exports the mixed-style fixture byte for byte", () => {
    check.preserves(
      readFileSync(new URL("fixtures/mixed-style.md", import.meta.url), "utf8"),
    );
  });

  it("keeps the source of the blocks an edit did not touch", () => {
    const service = createMarkdownService(new Context());
    service.register(createCommonmarkCodec());
    const markdown = "Title\n=====\n\n+ a\n+ b\n\n|x|y|\n|-|-|\n|1|2|\n";
    const document = service.parse(markdown);
    const content = document.body.content ?? [];
    const edited = content.map((block): BlockNode =>
      block.type === BLOCK_TYPES.heading
        ? { ...block, inline: [{ type: "text", text: "New" }] }
        : block,
    );
    expect(
      service.serialize({
        ...document,
        body: { ...document.body, content: edited },
      }),
    ).toBe("# New\n\n+ a\n+ b\n\n|x|y|\n|-|-|\n|1|2|\n");
  });
});
