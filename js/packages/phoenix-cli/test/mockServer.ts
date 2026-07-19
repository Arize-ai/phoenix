import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * Type-safe `http` namespace bound to the Phoenix OpenAPI `paths`. Handlers
 * written with it type-check path params, request bodies, and response bodies
 * against the API definition.
 */
export const http = createHttp();

/**
 * Register a mock Phoenix server for the current test file. Call at the top
 * level of a test module — it wires `beforeAll`/`afterEach`/`afterAll` hooks
 * so every Phoenix endpoint answers with schema-generated data, and returns a
 * handle whose `server` can be used to pin down specific responses:
 *
 * ```ts
 * const mock = setupMockPhoenixServer();
 *
 * it("lists projects", async () => {
 *   mock.server.use(
 *     http.get("/v1/projects", ({ response }) =>
 *       response(200).json({ data: [], next_cursor: null })
 *     )
 *   );
 *   // ...
 * });
 * ```
 *
 * Unhandled requests fail the test (`onUnhandledRequest: "error"`), so tests
 * that must NOT reach the network get that assertion for free.
 */
export function setupMockPhoenixServer(): { readonly server: Server } {
  let server: Server | undefined;

  beforeAll(async () => {
    server = await createMockServer();
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server?.resetHandlers();
  });

  afterAll(() => {
    server?.close();
  });

  return {
    get server(): Server {
      if (!server) {
        throw new Error(
          "Mock Phoenix server is not running — setupMockPhoenixServer() handles are only usable inside tests."
        );
      }
      return server;
    },
  };
}
