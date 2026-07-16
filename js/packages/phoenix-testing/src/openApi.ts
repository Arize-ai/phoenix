import { fromOpenApi } from "@mswjs/source/open-api";
import type { RequestHandler } from "msw";

import { phoenixOpenApiDocument } from "./__generated__/document.js";
import { DEFAULT_PHOENIX_MOCK_BASE_URL } from "./constants.js";

/**
 * Get a copy of the Phoenix OpenAPI document with its `servers` entry pointed
 * at the given base URL, so that generated handlers match absolute request
 * URLs issued by clients under test.
 *
 * @param params - configuration
 * @param params.baseUrl - the Phoenix server base URL requests are sent to
 */
export function getPhoenixOpenApiDocument({
  baseUrl = DEFAULT_PHOENIX_MOCK_BASE_URL,
}: {
  baseUrl?: string;
} = {}): Record<string, unknown> {
  return {
    ...phoenixOpenApiDocument,
    servers: [{ url: baseUrl }],
  };
}

/**
 * Create MSW request handlers for every operation in the Phoenix OpenAPI
 * definition. Responses are derived from the response schemas and examples
 * declared in the definition, so they are spec-conformant but contain
 * placeholder data. Compose these after your own handlers so that explicit
 * mocks take precedence:
 *
 * ```ts
 * const handlers = await createPhoenixOpenApiHandlers();
 * setupServer(...customHandlers, ...handlers);
 * ```
 *
 * @param params - configuration
 * @param params.baseUrl - the Phoenix server base URL requests are sent to
 */
export async function createPhoenixOpenApiHandlers({
  baseUrl = DEFAULT_PHOENIX_MOCK_BASE_URL,
}: {
  baseUrl?: string;
} = {}): Promise<RequestHandler[]> {
  const document = getPhoenixOpenApiDocument({ baseUrl });
  // The document is a runtime-validated JSON value; fromOpenApi's parameter
  // type is the openapi-types Document union, which structural typing of a
  // Record<string, unknown> cannot satisfy without a cast.
  return fromOpenApi(document as Parameters<typeof fromOpenApi>[0]);
}
