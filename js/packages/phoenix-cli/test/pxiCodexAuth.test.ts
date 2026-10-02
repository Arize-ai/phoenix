import * as fs from "fs";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PhoenixConfig } from "../src/config";
import { buildPxiCredentials } from "../src/pxi/client";
import {
  type CodexAuthFile,
  type CodexAuthApiError,
  clearCodexAuth,
  completeCodexBrowserAuthorization,
  ensureFreshCodexAuth,
  exchangeCodexAuthorizationCode,
  isCodexAuthStale,
  loadCodexAuth,
  pollCodexDeviceAuthorization,
  readCodexEmail,
  readJwtExpiresAt,
  saveCodexAuth,
  startCodexBrowserAuthorization,
  startCodexDeviceAuthorization,
  waitForCodexBrowserCallback,
  waitForCodexDeviceAuthorization,
} from "../src/pxi/codexAuth";

function encodeJwt(payload: Record<string, unknown>): string {
  const segment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${segment}.signature`;
}

const config: PhoenixConfig = {
  endpoint: "http://localhost:6006",
  apiKey: "px-key",
};

function buildAuth({
  expiresInSeconds = 3600,
  email = "user@example.com",
}: { expiresInSeconds?: number; email?: string } = {}): CodexAuthFile {
  return {
    auth_mode: "chatgpt",
    OPENAI_API_KEY: null,
    tokens: {
      id_token: encodeJwt({ email }),
      access_token: encodeJwt({
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      }),
      refresh_token: "refresh-1",
      account_id: "acct-1",
    },
    last_refresh: new Date().toISOString(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("codex auth file", () => {
  let dir: string;
  let authPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pxi-codex-"));
    authPath = path.join(dir, "codex_auth.json");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips the Codex CLI auth.json layout with mode 0600", () => {
    const auth = buildAuth();
    saveCodexAuth({ auth, authPath });
    expect(loadCodexAuth({ authPath })).toEqual(auth);
    const raw = JSON.parse(fs.readFileSync(authPath, "utf-8"));
    expect(raw.auth_mode).toBe("chatgpt");
    expect(Object.keys(raw.tokens).sort()).toEqual([
      "access_token",
      "account_id",
      "id_token",
      "refresh_token",
    ]);
    if (process.platform !== "win32") {
      expect(fs.statSync(authPath).mode & 0o777).toBe(0o600);
    }
  });

  it("returns null for a missing or malformed file", () => {
    expect(loadCodexAuth({ authPath })).toBeNull();
    fs.writeFileSync(authPath, "{not json");
    expect(loadCodexAuth({ authPath })).toBeNull();
    fs.writeFileSync(authPath, JSON.stringify({ auth_mode: "apikey" }));
    expect(loadCodexAuth({ authPath })).toBeNull();
  });

  it("clears the stored sign-in", () => {
    saveCodexAuth({ auth: buildAuth(), authPath });
    clearCodexAuth({ authPath });
    expect(loadCodexAuth({ authPath })).toBeNull();
    // Clearing an absent file is a no-op.
    expect(() => clearCodexAuth({ authPath })).not.toThrow();
  });

  it("reads the email and expiry out of the tokens", () => {
    const auth = buildAuth({ email: "me@arize.com", expiresInSeconds: 60 });
    expect(readCodexEmail(auth)).toBe("me@arize.com");
    expect(readJwtExpiresAt(auth.tokens.access_token)).toBeGreaterThan(
      Date.now()
    );
    expect(isCodexAuthStale(auth)).toBe(true);
    expect(isCodexAuthStale(buildAuth({ expiresInSeconds: 3600 }))).toBe(false);
  });

  it("refreshes a stale token and rewrites the file", async () => {
    saveCodexAuth({ auth: buildAuth({ expiresInSeconds: 10 }), authPath });
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const form = init?.body as URLSearchParams;
      expect(form.get("grant_type")).toBe("refresh_token");
      expect(form.get("refresh_token")).toBe("refresh-1");
      return jsonResponse({
        access_token: encodeJwt({
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
        token_type: "Bearer",
        refresh_token: "refresh-2",
        id_token: null,
        account_id: "acct-1",
      });
    });
    const fresh = await ensureFreshCodexAuth({
      config,
      authPath,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fresh?.tokens.refresh_token).toBe("refresh-2");
    expect(loadCodexAuth({ authPath })?.tokens.refresh_token).toBe("refresh-2");
  });

  it("clears the sign-in when the refresh grant is rejected", async () => {
    saveCodexAuth({ auth: buildAuth({ expiresInSeconds: 10 }), authPath });
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "invalid_grant" }, 400)
    );
    const fresh = await ensureFreshCodexAuth({
      config,
      authPath,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fresh).toBeNull();
    expect(loadCodexAuth({ authPath })).toBeNull();
  });
});

describe("codex device authorization", () => {
  const authorization = {
    device_code: "device-1",
    user_code: "ABCD-EFGH",
    verification_uri: "https://auth.openai.com/codex/device",
    expires_in: 900,
    interval: 5,
  };

  it("starts the grant through the Phoenix relay with the profile's auth", async () => {
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      expect(String(url)).toBe(
        "http://localhost:6006/codex/device_authorization"
      );
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer px-key"
      );
      return jsonResponse(authorization);
    });
    await expect(
      startCodexDeviceAuthorization({
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual(authorization);
  });

  it("treats authorization_pending as not finished yet", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "authorization_pending" }, 400)
    );
    await expect(
      pollCodexDeviceAuthorization({
        config,
        deviceCode: "device-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeNull();
  });

  it("surfaces a denied grant as an error with its code", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "access_denied", error_description: "The user declined." },
        400
      )
    );
    await expect(
      pollCodexDeviceAuthorization({
        config,
        deviceCode: "device-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({
      name: "CodexAuthApiError",
      code: "access_denied",
      message: "The user declined.",
    } satisfies Partial<CodexAuthApiError>);
  });

  it("polls at the advertised interval until approval", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls < 3
        ? jsonResponse({ error: "authorization_pending" }, 400)
        : jsonResponse({
            access_token: encodeJwt({ exp: 1 }),
            token_type: "Bearer",
            refresh_token: "refresh-1",
            id_token: encodeJwt({ email: "user@example.com" }),
            account_id: "acct-1",
          });
    });
    const sleeps: number[] = [];
    const auth = await waitForCodexDeviceAuthorization({
      config,
      authorization,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(auth?.tokens.account_id).toBe("acct-1");
    expect(sleeps).toEqual([5000, 5000]);
  });

  it("stops polling when cancelled", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "authorization_pending" }, 400)
    );
    const controller = new AbortController();
    const auth = await waitForCodexDeviceAuthorization({
      config,
      authorization,
      signal: controller.signal,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {
        controller.abort();
      },
    });
    expect(auth).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("buildPxiCredentials", () => {
  it("attaches the ChatGPT token only for Codex sessions", () => {
    const withCodex = buildPxiCredentials({
      config,
      modelSelection: { providerType: "codex", modelName: "gpt-5.4" },
      codexAccessToken: "chatgpt-token",
    });
    expect(withCodex).toEqual([
      { key: "OPENAI_CODEX_ACCESS_TOKEN", value: "chatgpt-token" },
    ]);
    const builtIn = buildPxiCredentials({
      config: { ...config, githubPersonalAccessToken: "gh-token" },
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.4",
      },
      codexAccessToken: "chatgpt-token",
    });
    expect(builtIn).toEqual([
      { key: "GITHUB_PERSONAL_ACCESS_TOKEN", value: "gh-token" },
    ]);
  });
});

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("no port"));
        }
      });
    });
  });
}

describe("codex browser authorization", () => {
  it("starts the grant through the Phoenix relay", async () => {
    const authorization = {
      authorization_url: "https://auth.openai.com/oauth/authorize?x=1",
      state: "state-1",
      code_verifier: "verifier-1",
      redirect_uri: "http://localhost:1455/auth/callback",
    };
    const fetchImpl = vi.fn(async (url: unknown) => {
      expect(String(url)).toBe("http://localhost:6006/codex/authorization_url");
      return jsonResponse(authorization);
    });
    await expect(
      startCodexBrowserAuthorization({
        config,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual(authorization);
  });

  it("exchanges the code with the PKCE verifier and redirect URI", async () => {
    const authorization = {
      authorization_url: "https://auth.openai.com/oauth/authorize?x=1",
      state: "state-1",
      code_verifier: "verifier-1",
      redirect_uri: "http://localhost:1455/auth/callback",
    };
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const form = init?.body as URLSearchParams;
      expect(form.get("grant_type")).toBe("authorization_code");
      expect(form.get("code")).toBe("code-1");
      expect(form.get("code_verifier")).toBe("verifier-1");
      expect(form.get("redirect_uri")).toBe(authorization.redirect_uri);
      return jsonResponse({
        access_token: encodeJwt({ exp: 1 }),
        token_type: "Bearer",
        refresh_token: "refresh-1",
        id_token: null,
        account_id: "acct-1",
      });
    });
    const auth = await exchangeCodexAuthorizationCode({
      config,
      code: "code-1",
      authorization,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(auth.tokens.account_id).toBe("acct-1");
  });

  it("receives the code from the redirect on the pinned callback", async () => {
    const port = await getFreePort();
    const authorization = {
      state: "state-1",
      redirect_uri: `http://127.0.0.1:${port}/auth/callback`,
    };
    const pending = waitForCodexBrowserCallback({ authorization });
    // Give the listener a tick to bind before the "browser" redirects.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const response = await fetch(
      `${authorization.redirect_uri}?code=code-1&state=state-1`
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Signed in");
    await expect(pending).resolves.toBe("code-1");
  });

  it("rejects a redirect whose state does not match", async () => {
    const port = await getFreePort();
    const authorization = {
      state: "state-1",
      redirect_uri: `http://127.0.0.1:${port}/auth/callback`,
    };
    const pending = waitForCodexBrowserCallback({ authorization });
    const rejection = expect(pending).rejects.toMatchObject({
      name: "CodexAuthApiError",
      code: "access_denied",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const response = await fetch(
      `${authorization.redirect_uri}?code=code-1&state=other`
    );
    expect(response.status).toBe(400);
    await rejection;
  });

  it("stops listening when cancelled", async () => {
    const port = await getFreePort();
    const controller = new AbortController();
    const pending = waitForCodexBrowserCallback({
      authorization: {
        state: "state-1",
        redirect_uri: `http://127.0.0.1:${port}/auth/callback`,
      },
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).resolves.toBeNull();
    // The port is released.
    await expect(
      fetch(`http://127.0.0.1:${port}/auth/callback`)
    ).rejects.toThrow();
  });

  it("explains a busy port instead of failing opaquely", async () => {
    const port = await getFreePort();
    const blocker = net.createServer();
    await new Promise<void>((resolve) =>
      blocker.listen(port, "127.0.0.1", () => resolve())
    );
    try {
      await expect(
        waitForCodexBrowserCallback({
          authorization: {
            state: "state-1",
            redirect_uri: `http://127.0.0.1:${port}/auth/callback`,
          },
        })
      ).rejects.toThrow(/already in use/);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it("completes the browser sign-in end to end", async () => {
    const port = await getFreePort();
    const authorization = {
      authorization_url: "https://auth.openai.com/oauth/authorize?x=1",
      state: "state-1",
      code_verifier: "verifier-1",
      redirect_uri: `http://127.0.0.1:${port}/auth/callback`,
    };
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        access_token: encodeJwt({ exp: 1 }),
        token_type: "Bearer",
        refresh_token: "refresh-1",
        id_token: encodeJwt({ email: "user@example.com" }),
        account_id: "acct-1",
      })
    );
    const pending = completeCodexBrowserAuthorization({
      config,
      authorization,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fetch(`${authorization.redirect_uri}?code=code-1&state=state-1`);
    const auth = await pending;
    expect(readCodexEmail(auth!)).toBe("user@example.com");
  });
});
