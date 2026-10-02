/**
 * ChatGPT (Codex subscription) sign-in for the PXI terminal client.
 *
 * Phoenix relays the OAuth requests to OpenAI, so PXI only ever talks to the
 * Phoenix server: `/codex/device_authorization` starts an RFC 8628 device
 * grant, `/codex/token` completes or refreshes it, and `/codex/models` lists
 * the subscription's models. Tokens are stored on disk in the same shape the
 * Codex CLI writes to `~/.codex/auth.json`.
 */

import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import type { componentsV1, pathsV1 } from "@arizeai/phoenix-client";
import { z } from "zod";

import type { PhoenixConfig } from "../config";
import { getConfigDir } from "../settings";

type SchemasV1 = componentsV1["schemas"];
export type CodexBrowserAuthorization =
  SchemasV1["CodexAuthorizationUrlResponse"];
export type CodexDeviceAuthorization =
  SchemasV1["CodexDeviceAuthorizationResponse"];
type CodexTokenResponse = SchemasV1["CodexTokenResponse"];
type CodexTokenErrorResponse = SchemasV1["CodexTokenErrorResponse"];
type CodexTokenErrorCode = CodexTokenErrorResponse["error"];

const AUTHORIZATION_URL_PATH =
  "/codex/authorization_url" satisfies keyof pathsV1;
const DEVICE_AUTHORIZATION_PATH =
  "/codex/device_authorization" satisfies keyof pathsV1;
const TOKEN_PATH = "/codex/token" satisfies keyof pathsV1;
const MODELS_PATH = "/codex/models" satisfies keyof pathsV1;

const AUTHORIZATION_CODE_GRANT_TYPE = "authorization_code";
const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_TOKEN_GRANT_TYPE = "refresh_token";

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;
export const CODEX_AUTH_FILE_NAME = "codex_auth.json";

/** The Codex CLI's `auth.json` layout, so the file is portable between the two. */
export const CodexAuthFileSchema = z.object({
  auth_mode: z.literal("chatgpt"),
  OPENAI_API_KEY: z.null().optional(),
  tokens: z.object({
    id_token: z.string().nullable(),
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    account_id: z.string().min(1),
  }),
  last_refresh: z.string(),
});

export type CodexAuthFile = z.infer<typeof CodexAuthFileSchema>;

export class CodexAuthApiError extends Error {
  readonly status: number;
  /** RFC 6749 §5.2 error code, when the token endpoint supplied one. */
  readonly code: CodexTokenErrorCode | null;
  constructor(
    status: number,
    message: string,
    code: CodexTokenErrorCode | null = null
  ) {
    super(message);
    this.name = "CodexAuthApiError";
    this.status = status;
    this.code = code;
  }
}

export function getCodexAuthPath(): string {
  return path.join(getConfigDir(), CODEX_AUTH_FILE_NAME);
}

/** The stored sign-in, or null when the file is missing or unreadable. */
export function loadCodexAuth({
  authPath = getCodexAuthPath(),
}: { authPath?: string } = {}): CodexAuthFile | null {
  let raw: string;
  try {
    raw = fs.readFileSync(authPath, "utf-8");
  } catch {
    return null;
  }
  try {
    const parsed = CodexAuthFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveCodexAuth({
  auth,
  authPath = getCodexAuthPath(),
}: {
  auth: CodexAuthFile;
  authPath?: string;
}): void {
  fs.mkdirSync(path.dirname(authPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(authPath, JSON.stringify(auth, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
  // writeFileSync only applies `mode` when it creates the file.
  fs.chmodSync(authPath, 0o600);
}

export function clearCodexAuth({
  authPath = getCodexAuthPath(),
}: { authPath?: string } = {}): void {
  fs.rmSync(authPath, { force: true });
}

export function toCodexAuthFile(tokens: CodexTokenResponse): CodexAuthFile {
  return {
    auth_mode: "chatgpt",
    OPENAI_API_KEY: null,
    tokens: {
      id_token: tokens.id_token ?? null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      account_id: tokens.account_id,
    },
    last_refresh: new Date().toISOString(),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (!segment) {
    return null;
  }
  try {
    const json = Buffer.from(segment, "base64url").toString("utf-8");
    const payload: unknown = JSON.parse(json);
    return payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Unverified JWT `exp` claim as unix ms, or null. A hint, not an authority. */
export function readJwtExpiresAt(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

/** The signed-in account's email from the id token, for display only. */
export function readCodexEmail(auth: CodexAuthFile): string | null {
  if (!auth.tokens.id_token) {
    return null;
  }
  const email = decodeJwtPayload(auth.tokens.id_token)?.email;
  return typeof email === "string" ? email : null;
}

export function isCodexAuthStale(
  auth: CodexAuthFile,
  now: number = Date.now()
): boolean {
  const expiresAt = readJwtExpiresAt(auth.tokens.access_token);
  return expiresAt !== null && expiresAt - REFRESH_LEEWAY_MS <= now;
}

function buildHeaders({ config }: { config: PhoenixConfig }): Headers {
  const headers = new Headers(config.headers ?? {});
  if (config.apiKey) {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  } else if (config.oauthTokens) {
    headers.set("Authorization", `Bearer ${config.oauthTokens.accessToken}`);
  }
  return headers;
}

function buildUrl({
  config,
  path: routePath,
}: {
  config: PhoenixConfig;
  path: string;
}) {
  if (!config.endpoint) {
    throw new Error("Phoenix endpoint not configured.");
  }
  return `${config.endpoint.replace(/\/+$/, "")}${routePath}`;
}

async function postJson<T>({
  config,
  path: routePath,
  body,
  fetchImpl,
}: {
  config: PhoenixConfig;
  path: string;
  body: unknown;
  fetchImpl: typeof globalThis.fetch;
}): Promise<T> {
  const headers = buildHeaders({ config });
  headers.set("Content-Type", "application/json");
  const response = await fetchImpl(buildUrl({ config, path: routePath }), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new CodexAuthApiError(
      response.status,
      text || `Request failed with status ${response.status}`
    );
  }
  return (await response.json()) as T;
}

/**
 * RFC 6749 token requests are form-encoded. A non-2xx response carries an
 * `error` code, surfaced on the thrown {@link CodexAuthApiError}.
 */
async function postTokenRequest({
  config,
  form,
  fetchImpl,
}: {
  config: PhoenixConfig;
  form: Record<string, string>;
  fetchImpl: typeof globalThis.fetch;
}): Promise<CodexTokenResponse> {
  const headers = buildHeaders({ config });
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  const response = await fetchImpl(buildUrl({ config, path: TOKEN_PATH }), {
    method: "POST",
    headers,
    body: new URLSearchParams(form),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: Partial<CodexTokenErrorResponse> = {};
    try {
      parsed = JSON.parse(text) as Partial<CodexTokenErrorResponse>;
    } catch {
      // Not an OAuth error body (e.g. a Phoenix auth failure); keep the text.
    }
    throw new CodexAuthApiError(
      response.status,
      parsed.error_description ??
        parsed.error ??
        (text || `Request failed with status ${response.status}`),
      parsed.error ?? null
    );
  }
  return (await response.json()) as CodexTokenResponse;
}

export function startCodexBrowserAuthorization({
  config,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexBrowserAuthorization> {
  return postJson<CodexBrowserAuthorization>({
    config,
    path: AUTHORIZATION_URL_PATH,
    body: {},
    fetchImpl,
  });
}

/** RFC 6749 §4.1.3: exchange the authorization code for tokens. */
export async function exchangeCodexAuthorizationCode({
  config,
  code,
  authorization,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  code: string;
  authorization: CodexBrowserAuthorization;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexAuthFile> {
  const tokens = await postTokenRequest({
    config,
    form: {
      grant_type: AUTHORIZATION_CODE_GRANT_TYPE,
      code,
      code_verifier: authorization.code_verifier,
      redirect_uri: authorization.redirect_uri,
    },
    fetchImpl,
  });
  return toCodexAuthFile(tokens);
}

function renderCallbackPage({ ok, detail }: { ok: boolean; detail: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>PXI sign-in</title>
<style>body{font-family:system-ui,sans-serif;margin:4rem auto;max-width:32rem;text-align:center}</style>
</head><body><h1>${ok ? "Signed in" : "Sign-in failed"}</h1><p>${detail}</p></body></html>`;
}

/**
 * Listen on the Codex client's fixed redirect URI (`localhost:1455`) for the
 * browser to come back with the authorization code, then close. Resolves to
 * `null` when `signal` aborts first. The public Codex OAuth client pins this
 * redirect, so the port cannot be chosen; a port already in use (the Codex
 * CLI mid-login, for instance) is reported so the user can pick the device
 * code instead.
 */
export async function waitForCodexBrowserCallback({
  authorization,
  signal,
}: {
  authorization: Pick<CodexBrowserAuthorization, "redirect_uri" | "state">;
  signal?: AbortSignal;
}): Promise<string | null> {
  const redirect = new URL(authorization.redirect_uri);
  const port = Number(redirect.port || 80);
  let settle!: (code: string | null) => void;
  let fail!: (error: Error) => void;
  const outcome = new Promise<string | null>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const server = http.createServer((request, response) => {
    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (requestUrl.pathname !== redirect.pathname) {
      response.writeHead(404).end("Not found");
      return;
    }
    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    let failure: string | null = null;
    if (error) {
      failure =
        requestUrl.searchParams.get("error_description") ??
        `OpenAI reported ${error}.`;
    } else if (state !== authorization.state) {
      failure = "The sign-in response did not match this PXI session.";
    } else if (!code) {
      failure = "The sign-in response carried no authorization code.";
    }
    // The socket is not held open after the reply, so the browser sees the
    // whole page before the server shuts down.
    response.writeHead(failure ? 400 : 200, {
      "Content-Type": "text/html; charset=utf-8",
      Connection: "close",
    });
    response.end(
      renderCallbackPage({
        ok: failure === null,
        detail: failure ?? "You can close this tab and return to PXI.",
      })
    );
    if (failure) {
      fail(new CodexAuthApiError(400, failure, "access_denied"));
    } else {
      settle(code);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "EADDRINUSE"
          ? new Error(
              `Port ${port} is already in use, so PXI cannot receive the browser sign-in. Close whatever is using it (often the Codex CLI) or sign in with a device code instead.`
            )
          : error
      );
    });
    server.listen(port, redirect.hostname, () => resolve());
  });

  const onAbort = () => settle(null);
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) {
    onAbort();
  }
  try {
    return await outcome;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });
  }
}

/**
 * Run the browser sign-in end to end: wait for the redirect, then exchange
 * its code through Phoenix. Resolves to `null` when cancelled.
 */
export async function completeCodexBrowserAuthorization({
  config,
  authorization,
  signal,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  authorization: CodexBrowserAuthorization;
  signal?: AbortSignal;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexAuthFile | null> {
  const code = await waitForCodexBrowserCallback({ authorization, signal });
  if (code === null) {
    return null;
  }
  return exchangeCodexAuthorizationCode({
    config,
    code,
    authorization,
    fetchImpl,
  });
}

export function startCodexDeviceAuthorization({
  config,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexDeviceAuthorization> {
  return postJson<CodexDeviceAuthorization>({
    config,
    path: DEVICE_AUTHORIZATION_PATH,
    body: {},
    fetchImpl,
  });
}

/**
 * One RFC 8628 §3.4 token request. Resolves to `null` while the user has not
 * finished signing in and throws once the grant is rejected or expired.
 */
export async function pollCodexDeviceAuthorization({
  config,
  deviceCode,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  deviceCode: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexAuthFile | null> {
  try {
    const tokens = await postTokenRequest({
      config,
      form: { grant_type: DEVICE_CODE_GRANT_TYPE, device_code: deviceCode },
      fetchImpl,
    });
    return toCodexAuthFile(tokens);
  } catch (error) {
    if (
      error instanceof CodexAuthApiError &&
      error.code === "authorization_pending"
    ) {
      return null;
    }
    throw error;
  }
}

export async function refreshCodexAuth({
  config,
  refreshToken,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  refreshToken: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexAuthFile> {
  const tokens = await postTokenRequest({
    config,
    form: { grant_type: REFRESH_TOKEN_GRANT_TYPE, refresh_token: refreshToken },
    fetchImpl,
  });
  return toCodexAuthFile(tokens);
}

export async function listCodexModels({
  config,
  accessToken,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  accessToken: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<string[]> {
  const result = await postJson<SchemasV1["CodexModelsResponseBody"]>({
    config,
    path: MODELS_PATH,
    body: { access_token: accessToken },
    fetchImpl,
  });
  return result.models;
}

/**
 * Wait for the user to approve the device grant, polling the token endpoint at
 * the server-advertised interval. Resolves with the saved sign-in, or `null`
 * when `signal` aborts first.
 */
export async function waitForCodexDeviceAuthorization({
  config,
  authorization,
  signal,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: {
  config: PhoenixConfig;
  authorization: CodexDeviceAuthorization;
  signal?: AbortSignal;
  fetchImpl?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<CodexAuthFile | null> {
  const intervalMs = Math.max(authorization.interval, 1) * 1000;
  const deadline = Date.now() + authorization.expires_in * 1000;
  while (!signal?.aborted) {
    if (Date.now() > deadline) {
      throw new CodexAuthApiError(
        400,
        "The sign-in code expired before it was approved.",
        "expired_token"
      );
    }
    const auth = await pollCodexDeviceAuthorization({
      config,
      deviceCode: authorization.device_code,
      fetchImpl,
    });
    if (signal?.aborted) {
      return null;
    }
    if (auth) {
      return auth;
    }
    await sleep(intervalMs);
  }
  return null;
}

/**
 * The stored sign-in with a fresh access token, refreshing and re-saving it
 * when it is about to expire. A rejected refresh clears the stored sign-in;
 * a transport failure keeps it, since the chat request reports a real error
 * if the token is in fact unusable.
 */
export async function ensureFreshCodexAuth({
  config,
  authPath = getCodexAuthPath(),
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  authPath?: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<CodexAuthFile | null> {
  const current = loadCodexAuth({ authPath });
  if (current === null || !isCodexAuthStale(current)) {
    return current;
  }
  try {
    const refreshed = await refreshCodexAuth({
      config,
      refreshToken: current.tokens.refresh_token,
      fetchImpl,
    });
    saveCodexAuth({ auth: refreshed, authPath });
    return refreshed;
  } catch (error) {
    if (error instanceof CodexAuthApiError && error.code === "invalid_grant") {
      clearCodexAuth({ authPath });
      return null;
    }
    return current;
  }
}
