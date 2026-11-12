/**
 * Incremental delivery (`@defer`) support for the Relay network layer.
 *
 * The server (Strawberry on graphql-core 3.3) streams a deferred operation as
 * a `multipart/mixed` response in the current incremental delivery format:
 * the first part carries `data` and the `pending` fragments, and later parts
 * carry `incremental` results keyed by those pending ids. This module reads
 * the parts off the wire; `RelayIncrementalDeliveryConverter` turns them into
 * the label/path payloads relay-runtime 21 applies.
 */

/** The `Accept` header for an operation that may stream deferred results. */
export const INCREMENTAL_ACCEPT_HEADER =
  "multipart/mixed; deferSpec=20220824, application/json";

/**
 * Whether the operation text uses `@defer`, the only incremental directive the
 * network layer translates. Plain operations keep the single JSON response.
 */
export function usesIncrementalDelivery(operationText: string | null) {
  return operationText != null && /@defer\b/.test(operationText);
}

/** Whether the response streams incremental parts. */
export function isMultipartMixedResponse(response: Response) {
  return /^multipart\/mixed\b/i.test(
    response.headers.get("content-type") ?? ""
  );
}

function getBoundary(response: Response): string {
  const contentType = response.headers.get("content-type") ?? "";
  const match = /boundary="?([^";]+)"?/i.exec(contentType);
  return match?.[1] ?? "-";
}

/**
 * Reads a `multipart/mixed` body and yields each part's parsed JSON body as
 * soon as the part is complete.
 */
export async function* readMultipartMixed(
  response: Response
): AsyncGenerator<unknown> {
  if (response.body == null) {
    return;
  }
  const delimiter = `\r\n--${getBoundary(response)}`;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // A leading CRLF lets the opening delimiter match like the others.
  let buffer = "\r\n";
  let hasOpened = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    buffer += value;
    let index = buffer.indexOf(delimiter);
    while (index !== -1) {
      const part = buffer.slice(0, index);
      buffer = buffer.slice(index + delimiter.length);
      // Text before the opening delimiter is the preamble, not a part.
      if (hasOpened) {
        const bodyStart = part.indexOf("\r\n\r\n");
        const body = bodyStart === -1 ? "" : part.slice(bodyStart + 4).trim();
        if (body !== "") {
          yield JSON.parse(body);
        }
      }
      hasOpened = true;
      // The closing delimiter is the delimiter followed by "--".
      if (buffer.startsWith("--")) {
        await reader.cancel();
        return;
      }
      index = buffer.indexOf(delimiter);
    }
  }
}
