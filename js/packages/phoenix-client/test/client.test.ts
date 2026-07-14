import { describe, expect, it } from "vitest";

import { createClient, HttpError } from "../src";

/** A client whose transport answers every request with `response`. */
function clientAnswering(response: Response) {
  return createClient({
    getEnvironmentOptions: () => ({}),
    options: {
      baseUrl: "https://phoenix.example.com",
      fetch: async () => response,
    },
  });
}

describe("non-2xx responses", () => {
  it("throw an HttpError carrying the status, so callers can branch on it", async () => {
    const client = clientAnswering(
      new Response(JSON.stringify({ detail: "unauthorized" }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "content-type": "application/json" },
      })
    );

    const error = await client.GET("/v1/projects").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401, statusText: "Unauthorized" });
    expect((error as HttpError).message).toContain("401 Unauthorized");
  });
});
