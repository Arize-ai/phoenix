import { describe, expect, it, vi } from "vitest";

import { createAuthFetch } from "../src/authFetch";

describe("createAuthFetch", () => {
  it("adds the current access token", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const authFetch = createAuthFetch({
      getAccessToken: () => "access-token",
      fetch: fetchImpl,
    });

    await authFetch("http://example.test/v1/projects", {
      headers: { "X-Tenant": "tenant" },
    });

    const request = fetchImpl.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (request instanceof Request) {
      expect(request.headers.get("Authorization")).toBe("Bearer access-token");
      expect(request.headers.get("X-Tenant")).toBe("tenant");
    }
  });

  it("refreshes and retries once after a 401", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const getAccessToken = vi.fn(
      ({ forceRefresh }: { forceRefresh: boolean }) =>
        forceRefresh ? "refreshed-token" : "access-token"
    );
    const authFetch = createAuthFetch({
      getAccessToken,
      fetch: fetchImpl,
    });

    const response = await authFetch("http://example.test/v1/projects", {
      method: "POST",
      body: "replayable body",
    });

    expect(response.status).toBe(200);
    expect(getAccessToken).toHaveBeenCalledTimes(3);
    expect(getAccessToken).toHaveBeenCalledWith({ forceRefresh: true });
    const retryRequest = fetchImpl.mock.calls[1]?.[0];
    expect(retryRequest).toBeInstanceOf(Request);
    if (retryRequest instanceof Request) {
      expect(retryRequest.headers.get("Authorization")).toBe(
        "Bearer refreshed-token"
      );
      await expect(retryRequest.text()).resolves.toBe("replayable body");
    }
  });

  it("coalesces refreshes for concurrent unauthorized requests", async () => {
    let resolveRefresh: ((token: string) => void) | undefined;
    const refresh = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });
    const getAccessToken = vi.fn(
      ({ forceRefresh }: { forceRefresh: boolean }) =>
        forceRefresh ? refresh : "access-token"
    );
    const fetchImpl = vi.fn<typeof fetch>(async (request) => {
      const token = new Request(request).headers.get("Authorization");
      return new Response(null, {
        status: token === "Bearer refreshed-token" ? 200 : 401,
      });
    });
    const authFetch = createAuthFetch({
      getAccessToken,
      fetch: fetchImpl,
    });

    const firstRequest = authFetch("http://example.test/v1/projects");
    const secondRequest = authFetch("http://example.test/v1/datasets");
    await vi.waitFor(() => {
      expect(getAccessToken).toHaveBeenCalledWith({ forceRefresh: true });
    });
    resolveRefresh?.("refreshed-token");

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      expect.objectContaining({ status: 200 }),
      expect.objectContaining({ status: 200 }),
    ]);
    expect(
      getAccessToken.mock.calls.filter(([options]) => options.forceRefresh)
    ).toHaveLength(1);
  });

  it("reuses a token refreshed while the request was in flight", async () => {
    let accessToken = "access-token";
    const getAccessToken = vi.fn(
      ({ forceRefresh }: { forceRefresh: boolean }) => {
        if (forceRefresh) throw new Error("unexpected refresh");
        return accessToken;
      }
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        accessToken = "already-refreshed-token";
        return new Response(null, { status: 401 });
      })
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const authFetch = createAuthFetch({
      getAccessToken,
      fetch: fetchImpl,
    });

    await expect(
      authFetch("http://example.test/v1/projects")
    ).resolves.toMatchObject({ status: 200 });
    expect(getAccessToken).not.toHaveBeenCalledWith({ forceRefresh: true });
    const retryRequest = fetchImpl.mock.calls[1]?.[0];
    expect(retryRequest).toBeInstanceOf(Request);
    if (retryRequest instanceof Request) {
      expect(retryRequest.headers.get("Authorization")).toBe(
        "Bearer already-refreshed-token"
      );
    }
  });

  it("calls onUnauthorized after the retry is also rejected", async () => {
    const onUnauthorized = vi.fn();
    const authFetch = createAuthFetch({
      getAccessToken: ({ forceRefresh }) =>
        forceRefresh ? "refreshed-token" : "access-token",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 401 })),
      onUnauthorized,
    });

    const response = await authFetch("http://example.test/v1/projects");

    expect(response.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
