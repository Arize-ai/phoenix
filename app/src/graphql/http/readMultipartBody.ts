/**
 * High-level reader for multipart/mixed GraphQL responses.
 *
 * Iterates the streaming parts produced by {@link consumeMultipartBody},
 * parses each as JSON, and passes the result to a callback. This is the
 * primary entry point used by the Relay network layer.
 *
 * Derived from Apollo Client's `readMultipartBody` (MIT License).
 * @see https://github.com/apollographql/apollo-client/blob/main/src/link/http/parseAndCheckHttpResponse.ts
 * @see https://github.com/apollographql/apollo-client/blob/main/LICENSE
 */

import { consumeMultipartBody } from "./consumeMultipartBody";

/**
 * Read a multipart/mixed HTTP response and invoke `nextValue` for each
 * parsed JSON payload.
 *
 * Empty JSON objects (`{}`) are skipped — these can appear as padding parts
 * in some server implementations.
 */
export async function readMultipartBody<T>(
  response: Response,
  nextValue: (value: T) => void
): Promise<void> {
  for await (const body of consumeMultipartBody(response)) {
    const result: Record<string, unknown> = JSON.parse(body);
    if (
      typeof result === "object" &&
      result !== null &&
      Object.keys(result).length === 0
    ) {
      continue;
    }
    // The GraphQL-over-HTTP incremental delivery spec (deferSpec=20220824)
    // wraps deferred payloads in an `incremental` array. Relay expects each
    // deferred payload as a flat object with top-level `data`, `path`, and
    // `label`. Unwrap the array so Relay can normalize each payload.
    if (Array.isArray(result.incremental)) {
      const items = result.incremental as Record<string, unknown>[];
      for (let i = 0; i < items.length; i++) {
        nextValue({
          ...items[i],
          hasNext: i < items.length - 1 ? true : (result.hasNext ?? false),
        } as T);
      }
    } else {
      nextValue(result as T);
    }
  }
}
