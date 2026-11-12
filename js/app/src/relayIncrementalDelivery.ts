/**
 * Incremental delivery (`@defer`) support for the Relay network layer.
 *
 * The server (Strawberry on graphql-core 3.3) streams a deferred operation as
 * a `multipart/mixed` response in the current incremental delivery format:
 * the first part carries `data` and the `pending` fragments, and later parts
 * carry `incremental` results keyed by those pending ids. Relay still reads
 * the earlier format, one payload per deferred fragment with its `path` and
 * `label`, so each part is translated before it reaches Relay. Strawberry
 * already copies `path` and `label` onto every incremental result, which keeps
 * the translation stateless.
 */
import type {
  GraphQLSingularResponse,
  PayloadData,
  PayloadError,
} from "relay-runtime";

import { isObject } from "./typeUtils";

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

type Path = Array<string | number>;

/** One part of an incremental response, as the server streams it. */
type IncrementalPart = {
  data?: PayloadData | null;
  errors?: PayloadError[];
  incremental?: ReadonlyArray<{
    data?: PayloadData;
    items?: unknown;
    path: Path;
    subPath?: Path;
    label?: string | null;
    errors?: PayloadError[];
  }>;
  completed?: ReadonlyArray<{ id: string; errors?: PayloadError[] }>;
};

/**
 * Translates one part of an incremental response into the payloads Relay
 * reads: the initial part becomes a plain response, and every deferred result
 * in a later part becomes its own payload addressed by `path` and `label`.
 * Errors stay on their payload; the caller decides how to surface them.
 */
export function toRelayResponses(part: unknown): GraphQLSingularResponse[] {
  if (!isObject(part)) {
    throw new Error("Malformed incremental response part");
  }
  const { data, errors, incremental, completed } = part as IncrementalPart;
  const responses: GraphQLSingularResponse[] = [];
  if ("data" in part) {
    responses.push(
      errors != null
        ? { data: data ?? undefined, errors }
        : { data: data ?? {} }
    );
  }
  for (const result of incremental ?? []) {
    if ("items" in result) {
      throw new Error("@stream results are not supported");
    }
    if (result.label == null) {
      // Relay labels every @defer it compiles and routes payloads by label.
      throw new Error("Deferred result is missing its label");
    }
    responses.push({
      data: result.data ?? {},
      path: [...result.path, ...(result.subPath ?? [])],
      label: result.label,
      ...(result.errors != null ? { errors: result.errors } : {}),
    });
  }
  // A deferred fragment that failed as a whole completes with errors and no
  // incremental result.
  const completedErrors = (completed ?? []).flatMap(
    (entry) => entry.errors ?? []
  );
  if (completedErrors.length > 0) {
    responses.push({ errors: completedErrors });
  }
  return responses;
}
