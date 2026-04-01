/**
 * GraphQL-over-HTTP multipart response parsing.
 *
 * Provides utilities for parsing `multipart/mixed` responses used by the
 * GraphQL `@defer` and `@stream` directives (deferSpec=20220824).
 *
 * @see https://github.com/graphql/graphql-over-http/blob/main/rfcs/IncrementalDelivery.md
 */

export { consumeMultipartBody } from "./consumeMultipartBody";
export { readMultipartBody } from "./readMultipartBody";
