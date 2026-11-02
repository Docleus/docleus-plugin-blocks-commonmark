import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPlugin, type Instance } from "./instance.ts";

describe("plain text", () => {
  let instance: Instance;

  beforeEach(async () => {
    instance = await loadPlugin();
  });

  afterEach(async () => {
    await instance.dispose();
  });

  it("includes the source of code blocks", () => {
    const { body } = instance.root.markdown.parse(
      "# Install\n\nRun this:\n\n```sh\nnpm install docleus\n```\n",
    );
    expect(instance.root.blocks.text(body)).toBe(
      "Install\nRun this:\nnpm install docleus",
    );
  });
});
