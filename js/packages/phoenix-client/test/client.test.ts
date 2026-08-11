import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createClient, HttpError } from "../src";
import { createTestClient } from "./testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("non-2xx responses", () => {
  it("throw an HttpError carrying the status, so callers can branch on it", async () => {
    server.use(
      http.get("/v1/projects", ({ response }) =>
        response.untyped(
          new Response(JSON.stringify({ detail: "unauthorized" }), {
            status: 401,
            statusText: "Unauthorized",
            headers: { "content-type": "application/json" },
          })
        )
      )
    );

    const error = await createTestClient()
      .GET("/v1/projects")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401, statusText: "Unauthorized" });
    expect((error as HttpError).response.status).toBe(401);
    expect((error as HttpError).message).toContain("401 Unauthorized");
  });
});

describe("getServerVersion", () => {
  // The version endpoint must go through the configured fetch (not the
  // global), so custom transports — OAuth token refresh, test doubles — cover
  // capability checks too.
  it("fetches the version via the configured fetch", async () => {
    const urls: string[] = [];
    const client = createClient({
      getEnvironmentOptions: () => ({}),
      options: {
        baseUrl: "http://phoenix.test",
        fetch: async (input: Request) => {
          urls.push(input.url);
          return new Response("20.1.2");
        },
      },
    });

    await expect(client.getServerVersion()).resolves.toEqual([20, 1, 2]);
    expect(urls).toEqual(["http://phoenix.test/arize_phoenix_version"]);
  });
});
