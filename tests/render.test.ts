import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPlugin, type Instance } from "./instance.ts";

const SAMPLES: Record<string, string> = {
  headings: "# One\n\n## Two *em*\n\n###### Six\n",
  "tight list": "- a\n- b\n  1. c\n  2. d\n",
  "loose list": "3. a\n\n4. b\n",
  "task list": "- [x] done\n- [ ] todo\n- plain\n",
  blockquote: "> quote with **bold**\n>\n> - item\n",
  code: '```ts title="a"\nconst a = 1 < 2;\n```\n\n    indented\n',
  image: '![alt "text"](img.png "Title") and ![x](javascript:alert(1))\n',
  "hard break": "line one\\\nline two\n",
  table: "| a | b | c |\n| :- | :-: | -: |\n| 1 | **2** | `3` |\n",
  "thematic break": "a\n\n***\n\nb\n",
  raw: '<div onclick="x">html</div>\n',
  link: '[a](https://example.com/?a=1&b=2 "t") [b](javascript:alert(1))\n',
};

describe("render", () => {
  let instance: Instance;

  beforeEach(async () => {
    instance = await loadPlugin();
  });

  afterEach(async () => {
    await instance.dispose();
  });

  it.each(Object.entries(SAMPLES))("renders %s", (_name, markdown) => {
    const { body } = instance.root.markdown.parse(markdown);
    const html = (body.content ?? [])
      .map((block) => instance.root.render.render(block).html)
      .join("\n");
    expect(html).toMatchSnapshot();
  });

  it("falls back to placeholders once the plugin unloads", async () => {
    const { body } = instance.root.markdown.parse("# Title\n\ntext\n");
    await instance.unloadPlugin();
    expect(
      (body.content ?? []).map((block) => instance.root.render.render(block)),
    ).toEqual([
      {
        html: '<div data-unknown-block="commonmark.heading"></div>',
        islands: [],
      },
      { html: '<div data-unknown-block="paragraph"></div>', islands: [] },
    ]);
  });
});
