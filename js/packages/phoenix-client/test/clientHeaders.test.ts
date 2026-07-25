import { afterEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../src";

/**
 * `getServerVersion` fetches `/arize_phoenix_version` directly rather than
 * through openapi-fetch, so it has to normalize the client's `headers` option
 * itself. That option accepts a `Headers` instance, an array of pairs, or a
 * record with non-string values — spreading it only handles the record form,
 * so a `Headers` instance previously spread to `{}` and dropped credentials.
 */
describe("getServerVersion header forwarding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi.fn(async () => new Response("1.0.0", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function headersOf(fetchMock: ReturnType<typeof stubFetch>): Headers {
    const init = fetchMock.mock.calls[0]?.[1];
    return new Headers(init?.headers);
  }

  it("forwards a Headers instance", async () => {
    const fetchMock = stubFetch();
    const client = createClient({
      getEnvironmentOptions: () => ({}),
      options: {
        baseUrl: "http://localhost:6006",
        headers: new Headers({ authorization: "Bearer token" }),
      },
    });

    await client.getServerVersion();

    expect(headersOf(fetchMock).get("authorization")).toBe("Bearer token");
  });

  it("forwards an array of header pairs", async () => {
    const fetchMock = stubFetch();
    const client = createClient({
      getEnvironmentOptions: () => ({}),
      options: {
        baseUrl: "http://localhost:6006",
        headers: [["authorization", "Bearer token"]],
      },
    });

    await client.getServerVersion();

    expect(headersOf(fetchMock).get("authorization")).toBe("Bearer token");
  });

  it("forwards a plain record", async () => {
    const fetchMock = stubFetch();
    const client = createClient({
      getEnvironmentOptions: () => ({}),
      options: {
        baseUrl: "http://localhost:6006",
        headers: { authorization: "Bearer token" },
      },
    });

    await client.getServerVersion();

    expect(headersOf(fetchMock).get("authorization")).toBe("Bearer token");
  });
});
