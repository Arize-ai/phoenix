import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../src";
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
    if (error instanceof HttpError) {
      expect(error.response.status).toBe(401);
      expect(error.message).toContain("401 Unauthorized");
    }
  });
});
