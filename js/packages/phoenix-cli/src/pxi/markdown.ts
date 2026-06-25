import { Marked, type Token } from "marked";
import { markedTerminal } from "marked-terminal";

// There is only ever one terminal width in play at a time, so a single cached
// renderer is enough to avoid re-registering the marked-terminal extension on
// every render. Rebuild it only when the width actually changes (e.g. resize),
// which keeps this bounded instead of accumulating an entry per resize.
let cachedRenderer: { width: number; renderer: Marked } | null = null;

function isAbsoluteOrSpecialHref(href: string): boolean {
  return (
    href.startsWith("#") ||
    href.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)
  );
}

function getPhoenixBaseUrl(phoenixBaseUrl?: string): URL | null {
  const trimmedBaseUrl = phoenixBaseUrl?.trim();
  if (!trimmedBaseUrl) {
    return null;
  }
  try {
    return new URL(trimmedBaseUrl);
  } catch {
    return null;
  }
}

function getOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

function getNormalizedBasePath(url: URL): string {
  return url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
}

export function resolvePhoenixMarkdownHref({
  href,
  phoenixBaseUrl,
}: {
  href: string;
  phoenixBaseUrl?: string;
}): string {
  const trimmedHref = href.trim();
  if (!trimmedHref || isAbsoluteOrSpecialHref(trimmedHref)) {
    return href;
  }

  const baseUrl = getPhoenixBaseUrl(phoenixBaseUrl);
  if (!baseUrl) {
    return href;
  }

  const origin = getOrigin(baseUrl);
  const basePath = getNormalizedBasePath(baseUrl);
  if (trimmedHref.startsWith("/")) {
    return new URL(`${basePath}${trimmedHref}`, origin).toString();
  }

  return new URL(trimmedHref, `${origin}${basePath}/`).toString();
}

function absolutizeMarkdownLinkToken({
  token,
  phoenixBaseUrl,
}: {
  token: Token;
  phoenixBaseUrl?: string;
}) {
  if (token.type !== "link" && token.type !== "image") {
    return;
  }
  token.href = resolvePhoenixMarkdownHref({
    href: token.href,
    phoenixBaseUrl,
  });
}

function getMarkedRenderer(width: number): Marked {
  if (cachedRenderer?.width === width) {
    return cachedRenderer.renderer;
  }
  const renderer = new Marked();
  renderer.use(
    markedTerminal(Number.isFinite(width) ? { width, reflowText: false } : {})
  );
  cachedRenderer = { width, renderer };
  return renderer;
}

function renderMarkdownBlock({
  text,
  maxWidth,
  phoenixBaseUrl,
}: {
  text: string;
  maxWidth: number;
  phoenixBaseUrl?: string;
}): string {
  if (text.trim() === "") {
    return "";
  }
  const renderer = getMarkedRenderer(maxWidth);
  // The marked-terminal extension renders synchronously, so `parse` returns a
  // string (marked's types don't narrow this from the `async: false` option).
  const rendered = renderer.parse(text, {
    async: false,
    walkTokens: (token) => {
      absolutizeMarkdownLinkToken({ token, phoenixBaseUrl });
    },
  }) as string;
  return rendered.replace(/\n+$/, "");
}

export function formatMarkdownForTerminal({
  text,
  maxWidth = process.stdout.columns ?? Infinity,
  phoenixBaseUrl,
}: {
  text: string;
  maxWidth?: number;
  phoenixBaseUrl?: string;
}): string {
  return renderMarkdownBlock({ text, maxWidth, phoenixBaseUrl });
}
