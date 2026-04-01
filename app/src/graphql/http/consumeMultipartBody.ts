/**
 * Async generator that streams a multipart/mixed HTTP response body and yields
 * the text content of each part.
 *
 * Implements boundary detection per RFC 2046 §5.1.1 and boundary parameter
 * parsing per RFC 9110.
 *
 * Derived from Apollo Client's `consumeMultipartBody` (MIT License).
 * @see https://github.com/apollographql/apollo-client/blob/main/src/link/http/parseAndCheckHttpResponse.ts
 * @see https://github.com/apollographql/apollo-client/blob/main/LICENSE
 */

import { parseMultipartHeaders } from "./parseMultipartHeaders";

/**
 * Regex to extract the boundary parameter from a Content-Type header.
 *
 * Supports three formats per RFC 9110 §5.6.6:
 *   - Single-quoted:  boundary='value'
 *   - Double-quoted:  boundary="value"
 *   - Unquoted:       boundary=value
 *
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#name-parameters
 */
const BOUNDARY_RE =
  /;\s*boundary=(?:'([^']+)'|"([^"]+)"|([^"'].+?))\s*(?:;|$)/i;

export async function* consumeMultipartBody(
  response: Response
): AsyncGenerator<string, void, undefined> {
  const decoder = new TextDecoder("utf-8");
  const contentType = response.headers?.get("content-type");

  // Extract the boundary value, defaulting to "-" if not specified.
  // Prepend "\r\n--" per RFC 2046 §5.1.1 (each boundary is preceded by a CRLF
  // and two hyphens).
  const match = contentType?.match(BOUNDARY_RE);
  const boundary =
    "\r\n--" + (match ? (match[1] ?? match[2] ?? match[3] ?? "-") : "-");

  let buffer = "";

  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error(
      "Response body is not a readable stream. " +
        "The server may not support streaming responses."
    );
  }

  const reader = response.body.getReader();
  let done = false;
  let encounteredBoundary = false;

  // The final boundary is a normal boundary immediately followed by "--"
  // as described in RFC 2046 §5.1.1.
  const passedFinalBoundary = () =>
    encounteredBoundary && buffer[0] === "-" && buffer[1] === "-";

  try {
    while (!done) {
      let value: Uint8Array | undefined;
      ({ value, done } = await reader.read());
      const chunk = typeof value === "string" ? value : decoder.decode(value);

      // Start searching for the boundary from the position where it could
      // first appear given the new data — handles boundaries that span chunks.
      const searchFrom = buffer.length - boundary.length + 1;
      buffer += chunk;

      let bi = buffer.indexOf(boundary, searchFrom);
      while (bi > -1 && !passedFinalBoundary()) {
        encounteredBoundary = true;

        let message: string;
        [message, buffer] = [
          buffer.slice(0, bi),
          buffer.slice(bi + boundary.length),
        ];

        // Each MIME part has headers separated from the body by a blank line.
        // Content before the first boundary (preamble per RFC 2046 §5.1.1) has
        // no header/body separator — skip it.
        const i = message.indexOf("\r\n\r\n");
        if (i === -1) {
          bi = buffer.indexOf(boundary);
          continue;
        }

        const headers = parseMultipartHeaders(message.slice(0, i));
        const partContentType = headers["content-type"];

        if (
          partContentType &&
          partContentType.toLowerCase().indexOf("application/json") === -1
        ) {
          throw new Error(
            "Unsupported patch content type: application/json is required."
          );
        }

        // The body starts after the \r\n\r\n separator. The leading \r\n is
        // harmless since JSON.parse ignores leading whitespace.
        const body = message.slice(i);
        if (body) {
          yield body;
        }

        bi = buffer.indexOf(boundary);
      }

      if (passedFinalBoundary()) {
        return;
      }
    }

    throw new Error("premature end of multipart body");
  } finally {
    reader.cancel();
  }
}
