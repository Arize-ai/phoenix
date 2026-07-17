import { createOpenApiHttp } from "openapi-msw";

import type { paths } from "./__generated__/api/v1.js";
import { DEFAULT_MOCK_BASE_URL } from "./constants.js";

/**
 * Create a type-safe MSW `http` namespace bound to the Phoenix OpenAPI paths.
 * Use it to write custom handler overrides whose paths, path params, request
 * bodies, and response bodies are all type-checked against the Phoenix API:
 *
 * ```ts
 * const http = createHttp();
 * const handler = http.get("/v1/datasets/{id}", ({ params, response }) =>
 *   response(200).json({ data: { ... } })
 * );
 * ```
 *
 * @param params - configuration
 * @param params.baseUrl - the Phoenix server base URL requests are sent to
 */
export function createHttp({
  baseUrl = DEFAULT_MOCK_BASE_URL,
}: {
  baseUrl?: string;
} = {}) {
  return createOpenApiHttp<paths>({ baseUrl });
}
