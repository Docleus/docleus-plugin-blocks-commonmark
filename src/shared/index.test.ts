import { readFileSync } from "node:fs";
import { parseManifest } from "@docleus/sdk";
import { describe, expect, it } from "vitest";
import {
  createCommonmarkCodec,
  parseCodeAttrs,
  parseHeadingAttrs,
  parseImageAttrs,
  parseListAttrs,
  parseListItemAttrs,
  parseTableAttrs,
  PLUGIN_NAME,
} from "./index.ts";

const manifest = parseManifest(
  JSON.parse(
    readFileSync(new URL("../../docleus.plugin.json", import.meta.url), "utf8"),
  ),
);

describe("plugin manifest", () => {
  it("names the same plugin as package.json", () => {
    expect(manifest.name).toBe(PLUGIN_NAME);
  });

  it("declares exactly the syntax the codec claims", () => {
    expect([...manifest.syntax].toSorted()).toEqual(
      [...createCommonmarkCodec().claims].toSorted(),
    );
  });
});

describe("attrs validators", () => {
  it("accept valid attrs", () => {
    expect(parseHeadingAttrs({ depth: 3 })).toEqual({ depth: 3 });
    expect(parseListAttrs({ ordered: true, start: 0, spread: false })).toEqual({
      ordered: true,
      start: 0,
      spread: false,
    });
    expect(
      parseListAttrs({ ordered: false, start: null, spread: true }),
    ).toEqual({ ordered: false, start: null, spread: true });
    expect(parseListItemAttrs({ checked: null })).toEqual({ checked: null });
    expect(parseCodeAttrs({ lang: "ts", meta: null, value: "x" })).toEqual({
      lang: "ts",
      meta: null,
      value: "x",
    });
    expect(parseTableAttrs({ align: ["left", null] })).toEqual({
      align: ["left", null],
    });
    expect(parseImageAttrs({ src: "a.png", alt: "" })).toEqual({
      src: "a.png",
      alt: "",
    });
    expect(parseImageAttrs({ src: "a.png", alt: "a", title: "t" })).toEqual({
      src: "a.png",
      alt: "a",
      title: "t",
    });
  });

  it.each([
    () => parseHeadingAttrs({ depth: 7 }),
    () => parseHeadingAttrs({}),
    () => parseListAttrs({ ordered: true, start: -1, spread: false }),
    () => parseListAttrs({ ordered: true, start: 1.5, spread: false }),
    () => parseListAttrs({ ordered: false, start: 1, spread: false }),
    () => parseListAttrs({ ordered: "yes", start: null, spread: false }),
    () => parseListItemAttrs({ checked: "x" }),
    () => parseCodeAttrs({ lang: 1, meta: null, value: "" }),
    () => parseCodeAttrs({ lang: null, meta: null }),
    () => parseTableAttrs({ align: ["middle"] }),
    () => parseTableAttrs({}),
    () => parseImageAttrs({ src: "a.png" }),
    () => parseImageAttrs({ src: "a.png", alt: "", title: 1 }),
  ])("reject invalid attrs (%#)", (parse) => {
    expect(parse).toThrow(
      expect.objectContaining({ code: "commonmark/invalid-attrs" }),
    );
  });

  it.each([
    [
      () => parseHeadingAttrs({ depth: 0 }),
      "invalid heading attrs: depth must be an integer from 1 to 6",
    ],
    [
      () => parseListAttrs({ ordered: false, start: 1, spread: false }),
      "invalid list attrs: start must be a non-negative integer for ordered lists and null otherwise",
    ],
    [
      () => parseListAttrs({ ordered: true, start: 1, spread: "no" }),
      "invalid list attrs: ordered and spread must be booleans",
    ],
    [
      () => parseImageAttrs({ src: "a.png", alt: "", title: 1 }),
      "invalid image attrs: title must be a string when present",
    ],
  ])("say what is wrong with invalid attrs (%#)", (parse, message) => {
    expect(parse).toThrow(message);
  });
});
