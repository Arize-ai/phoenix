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
    const result: T = JSON.parse(body);
    if (
      typeof result === "object" &&
      result !== null &&
      Object.keys(result).length === 0
    ) {
      continue;
    }
    nextValue(result);
  }
}
