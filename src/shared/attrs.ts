import { DocleusError, z } from "@docleus/sdk";
import type {
  Align,
  CodeAttrs,
  HeadingAttrs,
  ImageAttrs,
  ListAttrs,
  ListItemAttrs,
  TableAttrs,
} from "./types.ts";

type Attrs = Readonly<Record<string, unknown>>;

/** Parses `attrs` with `schema`, throwing `commonmark/invalid-attrs` with `message`. */
function parser<T>(
  type: string,
  schema: z.ZodType<T>,
  message: string,
): (attrs: Attrs) => T {
  return (attrs) => {
    const result = schema.safeParse(attrs);
    if (result.success) return result.data;
    throw new DocleusError(
      "commonmark/invalid-attrs",
      `invalid ${type} attrs: ${message}`,
    );
  };
}

const headingSchema: z.ZodType<HeadingAttrs> = z.object({
  depth: z.literal([1, 2, 3, 4, 5, 6]),
});

export const parseHeadingAttrs = parser(
  "heading",
  headingSchema,
  "depth must be an integer from 1 to 6",
);

const listFlags = z.object({ ordered: z.boolean(), spread: z.boolean() });
const parseListFlags = parser(
  "list",
  listFlags,
  "ordered and spread must be booleans",
);
const listStart = z.union([
  z.object({ ordered: z.literal(true), start: z.int().nonnegative() }),
  z.object({ ordered: z.literal(false), start: z.null() }),
]);
const parseListStart = parser(
  "list",
  listStart,
  "start must be a non-negative integer for ordered lists and null otherwise",
);

export function parseListAttrs(attrs: Attrs): ListAttrs {
  const { spread } = parseListFlags(attrs);
  const { ordered, start } = parseListStart(attrs);
  return { ordered, start, spread };
}

export const parseListItemAttrs: (attrs: Attrs) => ListItemAttrs = parser(
  "list item",
  z.object({ checked: z.boolean().nullable() }),
  "checked must be a boolean or null",
);

export const parseCodeAttrs: (attrs: Attrs) => CodeAttrs = parser(
  "code",
  z.object({
    lang: z.string().nullable(),
    meta: z.string().nullable(),
    value: z.string(),
  }),
  "lang and meta must be strings or null, value a string",
);

const alignSchema: z.ZodType<Align> = z
  .enum(["left", "right", "center"])
  .nullable();

export const parseTableAttrs: (attrs: Attrs) => TableAttrs = parser(
  "table",
  z.object({ align: z.array(alignSchema) }),
  "align must be a list of left, right, center or null",
);

const parseImageSource = parser(
  "image",
  z.object({ src: z.string(), alt: z.string() }),
  "src and alt must be strings",
);
const parseImageTitle = parser(
  "image",
  z.object({ title: z.string().optional() }),
  "title must be a string when present",
);

export function parseImageAttrs(attrs: Attrs): ImageAttrs {
  const { src, alt } = parseImageSource(attrs);
  const { title } = parseImageTitle(attrs);
  return title === undefined ? { src, alt } : { src, alt, title };
}
