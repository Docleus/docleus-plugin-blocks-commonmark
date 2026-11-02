const LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const IMAGE_SCHEMES = new Set(["http", "https"]);

// Browsers ignore control characters and spaces when they read a scheme,
// so `java\nscript:` must be judged as `javascript:`.
// oxlint-disable-next-line no-control-regex -- matching control characters is the point
const IGNORED = /[\u0000- ]/g;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

function schemeOf(url: string): string | undefined {
  return SCHEME.exec(url.replace(IGNORED, ""))?.[1]?.toLowerCase();
}

/** Returns `url` when it is safe as a link target, `undefined` otherwise. */
export function safeLinkUrl(url: string): string | undefined {
  const scheme = schemeOf(url);
  return scheme === undefined || LINK_SCHEMES.has(scheme) ? url : undefined;
}

/** Returns `url` when it is safe as an image source, `undefined` otherwise. */
export function safeImageUrl(url: string): string | undefined {
  const scheme = schemeOf(url);
  if (scheme === undefined || IMAGE_SCHEMES.has(scheme)) return url;
  return scheme === "data" &&
    url.replace(IGNORED, "").toLowerCase().startsWith("data:image/")
    ? url
    : undefined;
}
