/**
 * What counts as a Phoenix endpoint: an absolute `http://` or `https://` URL.
 *
 * `new URL("localhost:6006")` *parses* — protocol `localhost:`, origin "null" —
 * so a try/catch around `new URL` is not enough; the scheme has to be checked.
 */

export const ENDPOINT_REQUIREMENT =
  "must be a full http:// or https:// URL (e.g. https://app.phoenix.arize.com or http://localhost:6006)";

/** Tolerates surrounding whitespace. */
export function isEndpointUrl(value: string): boolean {
  return parseEndpointUrl(value) !== undefined;
}

/**
 * Normalize to an origin (plus any path) with no trailing slash, so a pasted
 * `http://localhost:6006/` and `http://localhost:6006` are the same endpoint
 * downstream.
 *
 * @throws TypeError if `value` is not an endpoint URL. Call `isEndpointUrl`
 * first where a message is wanted rather than a throw.
 */
export function normalizeEndpoint(value: string): string {
  const url = parseEndpointUrl(value);
  if (!url) {
    throw new TypeError(`Endpoint ${ENDPOINT_REQUIREMENT}`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function parseEndpointUrl(value: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  return url.protocol === "http:" || url.protocol === "https:"
    ? url
    : undefined;
}
