import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOAuthFetch } from "../src/authFetch";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  generatePkcePair,
  generateState,
  isOAuthTokenExpiring,
  parseOAuthCallbackUrl,
  refreshOAuthTokensForProfile,
  revokeOAuthToken,
  runBrowserLoginFlow,
  tokenResponseToOAuthTokens,
} from "../src/oauth";
import { type SettingsFile, saveSettings } from "../src/settings";

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function withServer(
  handler: http.RequestListener
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Server did not bind to a TCP port.");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OAuth PKCE and callback helpers", () => {
  it("generates a 64-byte base64url verifier and matching S256 challenge", () => {
    const pair = generatePkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pair.verifier.length).toBeGreaterThanOrEqual(86);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pair.challenge).toHaveLength(43);
  });

  it("generates 32-byte state as base64url", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state).toHaveLength(43);
  });

  it("builds the fixed first-party authorization URL", () => {
    const url = new URL(
      buildAuthorizationUrl({
        endpoint: "http://localhost:6006",
        redirectUri: "http://127.0.0.1:1234/callback",
        state: "state",
        codeChallenge: "challenge",
      })
    );
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("phoenix-cli");
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("preserves an endpoint root path in every OAuth URL", async () => {
    const endpoint = "http://localhost:18273/phoenix";
    const authorizationUrl = new URL(
      buildAuthorizationUrl({
        endpoint,
        redirectUri: "http://127.0.0.1:1234/callback",
        state: "state",
        codeChallenge: "challenge",
      })
    );
    expect(authorizationUrl.pathname).toBe("/phoenix/oauth2/authorize");

    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 120,
            token_type: "Bearer",
            scope: "",
          }),
          { status: 200 }
        )
    );

    await exchangeAuthorizationCode({
      endpoint,
      code: "code",
      redirectUri: "http://127.0.0.1:1234/callback",
      verifier: "verifier",
      fetchImpl,
    });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "http://localhost:18273/phoenix/oauth2/token"
    );

    await revokeOAuthToken({ endpoint, refreshToken: "refresh", fetchImpl });
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      "http://localhost:18273/phoenix/oauth2/revoke"
    );
  });

  it("parses success, denial, and state mismatch callbacks", () => {
    expect(
      parseOAuthCallbackUrl({
        redirectUrl: "http://127.0.0.1/callback?code=abc&state=expected",
        expectedState: "expected",
      })
    ).toEqual({ status: "success", code: "abc" });
    expect(
      parseOAuthCallbackUrl({
        redirectUrl:
          "http://127.0.0.1/callback?error=access_denied&state=expected",
        expectedState: "expected",
      })
    ).toEqual({ status: "access_denied" });
    expect(
      parseOAuthCallbackUrl({
        redirectUrl: "http://127.0.0.1/callback?code=abc&state=wrong",
        expectedState: "expected",
      })
    ).toMatchObject({ status: "invalid" });
  });
});

describe("browser login flow", () => {
  it("abandons the wait as cancelled when the signal aborts", async () => {
    const abandon = new AbortController();
    const flow = runBrowserLoginFlow({
      endpoint: "http://127.0.0.1:1",
      onAuthorizationUrl: () => abandon.abort(),
      // No browser and no paste prompt: the abort is the only way this ends.
      openBrowserWindow: false,
      allowPastedRedirect: false,
      signal: abandon.signal,
    });
    await expect(flow).resolves.toEqual({ status: "cancelled" });
  });

  it("exchanges the code once the callback arrives", async () => {
    const tokenServer = await withServer((request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          access_token: "access-abc",
          refresh_token: "refresh-abc",
          token_type: "Bearer",
          expires_in: 3600,
        })
      );
    });
    try {
      const result = await runBrowserLoginFlow({
        endpoint: tokenServer.url,
        // Drive the loopback callback ourselves, standing in for the browser.
        onAuthorizationUrl: async (url) => {
          const redirectUri = new URL(url).searchParams.get("redirect_uri")!;
          const state = new URL(url).searchParams.get("state")!;
          await fetch(`${redirectUri}?code=code-abc&state=${state}`);
        },
        openBrowserWindow: false,
        allowPastedRedirect: false,
      });
      expect(result).toMatchObject({
        status: "success",
        tokens: { access_token: "access-abc" },
      });
    } finally {
      await tokenServer.close();
    }
  });
});

describe("OAuth token parsing and refresh", () => {
  it("converts token endpoint JSON into persisted OAuth tokens", () => {
    const tokens = tokenResponseToOAuthTokens({
      response: {
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 120,
        token_type: "Bearer",
        scope: "",
      },
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(tokens).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: "2026-01-01T00:02:00.000Z",
      scope: "",
    });
  });

  it("uses the 60 second refresh buffer", () => {
    expect(
      isOAuthTokenExpiring({
        tokens: {
          accessToken: "a",
          refreshToken: "r",
          expiresAt: "2026-01-01T00:00:59.000Z",
          scope: "",
        },
        now: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toBe(true);
    expect(
      isOAuthTokenExpiring({
        tokens: {
          accessToken: "a",
          refreshToken: "r",
          expiresAt: "2026-01-01T00:01:01.000Z",
          scope: "",
        },
        now: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toBe(false);
  });

  it("re-reads settings under the lock and skips refresh when another process rotated", async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "phoenix-oauth-test-")
    );
    const settingsPath = path.join(tmpDir, "px", "settings.json");
    try {
      const settings: SettingsFile = {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "http://example.test",
            oauthTokens: {
              accessToken: "fresh-access",
              refreshToken: "fresh-refresh",
              expiresAt: "2999-01-01T00:00:00.000Z",
              scope: "",
            },
          },
        },
      };
      saveSettings(settings, { settingsPath });
      const fetchMock = vi.fn<typeof fetch>();
      const tokens = await refreshOAuthTokensForProfile({
        endpoint: "http://example.test",
        profileName: "prod",
        currentTokens: {
          accessToken: "stale-access",
          refreshToken: "stale-refresh",
          expiresAt: "2000-01-01T00:00:00.000Z",
          scope: "",
        },
        settingsPath,
        fetchImpl: fetchMock,
      });
      expect(tokens.accessToken).toBe("fresh-access");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("persists rotated refresh tokens", async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "phoenix-oauth-test-")
    );
    const settingsPath = path.join(tmpDir, "px", "settings.json");
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      saveSettings(
        {
          activeProfile: "prod",
          profiles: {
            prod: {
              endpoint: "http://example.test",
              oauthTokens: {
                accessToken: "old-access",
                refreshToken: "old-refresh",
                expiresAt: "2000-01-01T00:00:00.000Z",
                scope: "",
              },
            },
          },
        },
        { settingsPath }
      );
      server = await withServer(async (request, response) => {
        expect(request.url).toBe("/oauth2/token");
        const body = new URLSearchParams(await readRequestBody(request));
        expect(body.get("grant_type")).toBe("refresh_token");
        expect(body.get("refresh_token")).toBe("old-refresh");
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 600,
            token_type: "Bearer",
            scope: "",
          })
        );
      });
      const tokens = await refreshOAuthTokensForProfile({
        endpoint: server.url,
        profileName: "prod",
        currentTokens: {
          accessToken: "old-access",
          refreshToken: "old-refresh",
          expiresAt: "2000-01-01T00:00:00.000Z",
          scope: "",
        },
        settingsPath,
      });
      expect(tokens.accessToken).toBe("new-access");
      const saved: SettingsFile = JSON.parse(
        fs.readFileSync(settingsPath, "utf-8")
      );
      expect(saved.profiles.prod.oauthTokens?.refreshToken).toBe("new-refresh");
    } finally {
      await server?.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("OAuth fetch wrapper", () => {
  it("refreshes before requests inside the expiry buffer", async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "phoenix-oauth-test-")
    );
    const settingsPath = path.join(tmpDir, "px", "settings.json");
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    try {
      saveSettings(
        {
          activeProfile: "prod",
          profiles: {
            prod: {
              endpoint: "http://example.test",
              oauthTokens: {
                accessToken: "old-access",
                refreshToken: "old-refresh",
                expiresAt: "2000-01-01T00:00:00.000Z",
                scope: "",
              },
            },
          },
        },
        { settingsPath }
      );
      server = await withServer(async (request, response) => {
        if (request.url === "/oauth2/token") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              access_token: "new-access",
              refresh_token: "new-refresh",
              expires_in: 600,
              token_type: "Bearer",
              scope: "",
            })
          );
          return;
        }
        expect(request.headers.authorization).toBe("Bearer new-access");
        response.writeHead(200);
        response.end("ok");
      });

      const oauthFetch = createOAuthFetch({
        config: {
          endpoint: server.url,
          profileName: "prod",
          oauthTokens: {
            accessToken: "old-access",
            refreshToken: "old-refresh",
            expiresAt: "2000-01-01T00:00:00.000Z",
            scope: "",
          },
        },
        settingsPath,
      });
      const response = await oauthFetch(`${server.url}/v1/user`);
      expect(response.status).toBe(200);
    } finally {
      await server?.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("retries once after a 401 and reports expired sessions after retry failure", async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "phoenix-oauth-test-")
    );
    const settingsPath = path.join(tmpDir, "px", "settings.json");
    let server: Awaited<ReturnType<typeof withServer>> | undefined;
    let protectedRequestCount = 0;
    try {
      saveSettings(
        {
          activeProfile: "prod",
          profiles: {
            prod: {
              endpoint: "http://example.test",
              oauthTokens: {
                accessToken: "access",
                refreshToken: "refresh",
                expiresAt: "2999-01-01T00:00:00.000Z",
                scope: "",
              },
            },
          },
        },
        { settingsPath }
      );
      server = await withServer((request, response) => {
        if (request.url === "/oauth2/token") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              access_token: "rotated-access",
              refresh_token: "rotated-refresh",
              expires_in: 600,
              token_type: "Bearer",
              scope: "",
            })
          );
          return;
        }
        protectedRequestCount += 1;
        response.writeHead(401);
        response.end();
      });
      const oauthFetch = createOAuthFetch({
        config: {
          endpoint: server.url,
          profileName: "prod",
          oauthTokens: {
            accessToken: "access",
            refreshToken: "refresh",
            expiresAt: "2999-01-01T00:00:00.000Z",
            scope: "",
          },
        },
        settingsPath,
      });
      await expect(oauthFetch(`${server.url}/v1/user`)).rejects.toThrow(
        "Session expired. Run: px auth login"
      );
      expect(protectedRequestCount).toBe(2);
    } finally {
      await server?.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns 403 responses to the caller", async () => {
    const oauthFetch = createOAuthFetch({
      config: {
        endpoint: "http://example.test",
        profileName: "prod",
        oauthTokens: {
          accessToken: "access",
          refreshToken: "refresh",
          expiresAt: "2999-01-01T00:00:00.000Z",
          scope: "",
        },
      },
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 403 })),
    });
    const response = await oauthFetch("http://example.test/v1/projects");
    expect(response.status).toBe(403);
  });
});
