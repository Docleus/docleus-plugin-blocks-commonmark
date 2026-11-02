import { defineConfig } from "tsdown";

const common = {
  format: "esm",
  dts: false,
  outExtensions: () => ({ js: ".js" }),
} as const;

export default defineConfig([
  {
    ...common,
    entry: {
      "shared/index": "src/shared/index.ts",
      "server/index": "src/server/index.ts",
    },
    clean: ["dist/shared", "dist/server", "dist/*.js"],
  },
  {
    // A build of its own, so its chunks stay inside the browser root the
    // server serves, `dist/editor`.
    ...common,
    entry: { index: "src/editor/index.ts" },
    outDir: "dist/editor",
    platform: "browser",
    clean: true,
  },
]);
