const MARKDOWN_HTML_AMPERSAND_PATTERN = /&amp;/gi;
const MARKDOWN_BACKSLASH_ESCAPE_PATTERN = /\\([?&=#])/g;

export type MarkdownHrefLocation = {
  pathname: string;
  search: string;
  hash: string;
};

export type NormalizedMarkdownHref =
  | {
      kind: "internal";
      to: MarkdownHrefLocation;
    }
  | {
      kind: "external";
      href: string;
    };

/**
 * Undo markdown/HTML artifacts that corrupt query strings without decoding
 * percent-encoded URL values.
 *
 * @param params - Unescape inputs.
 * @param params.href - Raw markdown href, possibly with `&amp;` or `\\?`.
 */
export function unescapeMarkdownHrefArtifacts({
  href,
}: {
  href: string;
}): string {
  return href
    .trim()
    .replace(MARKDOWN_HTML_AMPERSAND_PATTERN, "&")
    .replace(MARKDOWN_BACKSLASH_ESCAPE_PATTERN, "$1");
}

/**
 * Split search and hash off an href while leaving encoded query values intact.
 *
 * `URL.search` can normalize encodings; PXI links must keep `%20`, `%3D`, and
 * similar sequences as authored.
 *
 * @param params - Split inputs.
 * @param params.href - Href after artifact unescape.
 */
function splitSearchAndHash({ href }: { href: string }): {
  withoutSearchOrHash: string;
  search: string;
  hash: string;
} {
  let withoutHash = href;
  let hash = "";
  const hashIndex = withoutHash.indexOf("#");
  if (hashIndex >= 0) {
    hash = withoutHash.slice(hashIndex);
    withoutHash = withoutHash.slice(0, hashIndex);
  }

  let withoutSearchOrHash = withoutHash;
  let search = "";
  const searchIndex = withoutSearchOrHash.indexOf("?");
  if (searchIndex >= 0) {
    search = withoutSearchOrHash.slice(searchIndex);
    withoutSearchOrHash = withoutSearchOrHash.slice(0, searchIndex);
  }

  return { withoutSearchOrHash, search, hash };
}

/**
 * Classify a markdown href as an in-app Router location or an external URL.
 *
 * @param params - Normalization inputs.
 * @param params.href - Destination from the markdown link, not the display text.
 * @param params.baseUrl - Origin used to detect same-app links. Defaults to the
 * current window location so tests can inject a stable base.
 */
export function normalizeMarkdownHref({
  href,
  baseUrl = typeof window === "undefined" ? undefined : window.location.href,
}: {
  href: string | undefined;
  baseUrl?: string;
}): NormalizedMarkdownHref {
  const cleanedHref = unescapeMarkdownHrefArtifacts({ href: href ?? "" });
  if (!cleanedHref) {
    return { kind: "external", href: "" };
  }
  if (!baseUrl) {
    return { kind: "external", href: cleanedHref };
  }

  const isProtocolRelative = cleanedHref.startsWith("//");
  try {
    const parsed = new URL(cleanedHref, baseUrl);
    const base = new URL(baseUrl);
    if (isProtocolRelative || parsed.origin !== base.origin) {
      const isAlreadyAbsolute = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(cleanedHref);
      return {
        kind: "external",
        href: isAlreadyAbsolute ? cleanedHref : parsed.href,
      };
    }

    const { withoutSearchOrHash, search, hash } = splitSearchAndHash({
      href: cleanedHref,
    });
    const pathname = new URL(withoutSearchOrHash, baseUrl).pathname;
    return {
      kind: "internal",
      to: {
        pathname,
        search,
        hash,
      },
    };
  } catch {
    return { kind: "external", href: cleanedHref };
  }
}
