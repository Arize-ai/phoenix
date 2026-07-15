import { describe, expect, it } from "vitest";

import { createSystemOAuthLogin } from "../../src/setup/deps/oauthLogin";
import { fakeFetch, jsonResponse } from "./fakes";

const METADATA = {
  issuer: "http://phoenix.example",
  authorization_endpoint: "http://phoenix.example/oauth2/authorize",
  token_endpoint: "http://phoenix.example/oauth2/token",
};

describe("setup OAuth login capability probe", () => {
  it("reports support for a well-formed authorization server document", async () => {
    const login = createSystemOAuthLogin({
      fetchImpl: fakeFetch(() => jsonResponse(200, METADATA)),
    });
    await expect(login.isSupported("http://phoenix.example")).resolves.toBe(
      true
    );
  });

  it("rejects the SPA index.html an older Phoenix serves with a 200", async () => {
    const login = createSystemOAuthLogin({
      fetchImpl: fakeFetch(
        () =>
          new Response("<!doctype html><title>Phoenix</title>", {
            status: 200,
            headers: { "content-type": "text/html" },
          })
      ),
    });
    await expect(login.isSupported("http://phoenix.example")).resolves.toBe(
      false
    );
  });

  it("rejects JSON that is missing the endpoints the flow needs", async () => {
    const login = createSystemOAuthLogin({
      fetchImpl: fakeFetch(() =>
        jsonResponse(200, { issuer: "http://phoenix.example" })
      ),
    });
    await expect(login.isSupported("http://phoenix.example")).resolves.toBe(
      false
    );
  });

  it("treats a 404 from a server without the authorization server as unsupported", async () => {
    const login = createSystemOAuthLogin({
      fetchImpl: fakeFetch(() => jsonResponse(404, { detail: "Not Found" })),
    });
    await expect(login.isSupported("http://phoenix.example")).resolves.toBe(
      false
    );
  });

  it("probes the --api-url override rather than the user-facing endpoint", async () => {
    const probed: string[] = [];
    const login = createSystemOAuthLogin({
      apiUrl: "http://localhost:6006",
      fetchImpl: fakeFetch((url) => {
        probed.push(url);
        return jsonResponse(200, METADATA);
      }),
    });
    await login.isSupported("http://phoenix.example");
    expect(probed).toEqual([
      "http://localhost:6006/.well-known/oauth-authorization-server",
    ]);
  });

  it("treats an unreachable server as unsupported", async () => {
    const login = createSystemOAuthLogin({
      // No handler matches, so fakeFetch throws — the transport-failure case.
      fetchImpl: fakeFetch(() => undefined),
    });
    await expect(login.isSupported("http://phoenix.example")).resolves.toBe(
      false
    );
  });

  it("reports cancelled without opening a browser when the wait is already abandoned", async () => {
    const abandoned = new AbortController();
    abandoned.abort();
    const login = createSystemOAuthLogin({
      fetchImpl: fakeFetch(() => jsonResponse(200, METADATA)),
    });
    const outcome = await login.login({
      endpoint: "http://phoenix.example",
      onAuthorizationUrl: () => {
        throw new Error("must not narrate a URL for an abandoned login");
      },
      onBrowserOpenFailed: () => {
        throw new Error("must not launch a browser for an abandoned login");
      },
      signal: abandoned.signal,
    });
    expect(outcome).toEqual({ status: "cancelled" });
  });
});
