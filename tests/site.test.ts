import {
  definePlugin,
  type Entry,
  type SiteLayoutInput,
  type SitePage,
} from "@docleus/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPlugin, type Instance } from "./instance.ts";

const MARKDOWN =
  "# Guide\n\nIntro.\n\n## Usage\n\n> ### Usage\n\n- ## In a *list*\n\n## `code` and [link](/x)\n";

function sitePage(entry: Entry): SitePage {
  return {
    kind: "page",
    site: { id: "s1", name: "Site", settings: undefined },
    space: { id: "sp1", orgId: "o1", slug: "docs", name: "Docs" },
    revision: "r1",
    entry,
    path: "/",
    title: entry.title,
    nav: [{ entryId: entry.id, title: entry.title, path: "/", children: [] }],
    prev: undefined,
    next: undefined,
    url: (path) => `.${path}`,
    asset: (plugin, file) => `./_assets/plugins/${plugin}/${file}`,
  };
}

describe("site pages", () => {
  let instance: Instance;
  let layouts: SiteLayoutInput[];

  beforeEach(async () => {
    instance = await loadPlugin();
    layouts = [];
    await instance.root.plugin(
      definePlugin({
        name: "test.site",
        inject: ["render"],
        apply(ctx) {
          ctx.render.registerTheme("test.theme", {
            layout(input) {
              layouts.push(input);
              return `<!doctype html><main>${input.body.html}</main>`;
            },
          });
        },
      }),
    );
  });

  afterEach(async () => {
    await instance.dispose();
  });

  function renderPage(markdown: string) {
    const { body } = instance.root.markdown.parse(markdown);
    const entry: Entry = {
      id: "e1",
      type: "page",
      title: "Guide",
      parent: undefined,
      order: 0,
      fields: {},
      body,
    };
    return instance.root.render.renderPage(sitePage(entry), {
      theme: "test.theme",
    });
  }

  it("gives headings ids unique within the page", () => {
    const { html } = renderPage(MARKDOWN);
    expect(html).not.toContain("data-unknown-block");
    const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(ids).toEqual([
      "guide",
      "usage",
      "usage-2",
      "in-a-list",
      "code-and-link",
    ]);
  });

  it("passes the outline to the theme", () => {
    renderPage(MARKDOWN);
    expect(layouts).toHaveLength(1);
    expect(layouts[0]?.body.outline).toEqual([
      { anchor: "guide", depth: 1, text: "Guide" },
      { anchor: "usage", depth: 2, text: "Usage" },
      { anchor: "usage-2", depth: 3, text: "Usage" },
      { anchor: "in-a-list", depth: 2, text: "In a list" },
      { anchor: "code-and-link", depth: 2, text: "code and link" },
    ]);
  });

  it("starts anchors over on every page", () => {
    renderPage("## Usage\n");
    const { html } = renderPage("## Usage\n");
    expect(html).toContain('<h2 id="usage">Usage</h2>');
  });
});
