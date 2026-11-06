import type { RequestHandler } from "msw";
import { setupServer, type SetupServer } from "msw/node";

import { DEFAULT_MOCK_BASE_URL } from "./constants.js";
import { createOpenApiHandlers } from "./openApi.js";

export type Server = SetupServer;

/**
 * Create an MSW server (for Node.js test runners such as vitest and jest)
 * pre-loaded with handlers for every Phoenix API operation, generated from
 * the Phoenix OpenAPI definition.
 *
 * Handlers passed via `handlers` are registered before the generated ones,
 * so they take precedence — use them (together with `createHttp`) to
 * pin down the exact responses a test cares about while every other endpoint
 * still answers with a spec-conformant placeholder.
 *
 * ```ts
 * const server = await createMockServer();
 * beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * @param params - configuration
 * @param params.baseUrl - the Phoenix server base URL requests are sent to
 * @param params.handlers - custom handlers that take precedence over the generated ones
 */
export async function createMockServer({
  baseUrl = DEFAULT_MOCK_BASE_URL,
  handlers = [],
}: {
  baseUrl?: string;
  handlers?: RequestHandler[];
} = {}): Promise<Server> {
  const openApiHandlers = await createOpenApiHandlers({ baseUrl });
  return setupServer(...handlers, ...openApiHandlers);
}

export * from "./index.js";
