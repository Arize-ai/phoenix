import { spawn } from "child_process";
import { createHash, randomBytes } from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as readline from "readline";
import { z } from "zod";

import { AuthRequiredError, NetworkError } from "./exitCodes";
import { renderOAuthCallbackPage } from "./oauthCallbackPage";
import {
  type OAuthTokens,
  type SettingsFile,
  getProfileByName,
  getSettingsPath,
  getStoredActiveProfile,
  loadSettings,
  saveSettings,
} from "./settings";

export const OAUTH_CLIENT_ID = "phoenix-cli";
export const OAUTH_CALLBACK_PATH = "/callback";
const OAUTH_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * Bounds every token-endpoint round trip. Without it a proxy that accepts the
 * socket but never answers strands the CLI for undici's 300s default, long
 * past the point where the user has already consented in the browser. Generous
 * because the code is single-use: aborting a slow-but-live exchange costs the
 * user the whole browser consent, so this must clear a cold-starting server.
 */
export const OAUTH_TOKEN_REQUEST_TIMEOUT_MS = 30 * 1000;
/** Best-effort and blocking a wizard, so it gives up sooner than a token call. */
export const OAUTH_REVOKE_TIMEOUT_MS = 10 * 1000;
/**
 * A quick pre-flight, not a token exchange: nothing has been consented to yet,
 * so giving up fast costs the user only a retry, not a browser round trip.
 */
export const OAUTH_DISCOVERY_TIMEOUT_MS = 5 * 1000;
export const OAUTH_REFRESH_BUFFER_MS = 60 * 1000;
const SETTINGS_LOCK_TIMEOUT_MS = 10 * 1000;
const SETTINGS_LOCK_RETRY_MS = 50;

export const OAuthTokenEndpointResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().regex(/^bearer$/i),
  scope: z.string().optional().default(""),
});

export type OAuthTokenEndpointResponse = z.infer<
  typeof OAuthTokenEndpointResponseSchema
>;

/**
 * The RFC 8414 discovery fields the login flow depends on. Only a document
 * that parses proves an authorization server is really there: a Phoenix
 * without one answers unknown paths with the SPA's index.html and a 200.
 */
export const OAuthAuthorizationServerMetadataSchema = z.object({
  issuer: z.string().min(1),
  authorization_endpoint: z.string().min(1),
  token_endpoint: z.string().min(1),
});

export type OAuthDiscoveryResult =
  /** The server is up and advertises a working authorization server. */
  | { status: "supported" }
  /** The server answered, but not with RFC 8414 metadata — no OAuth here. */
  | { status: "unsupported" }
  /** The server never answered or is unhealthy: down, timed out, or 5xx. */
  | { status: "unreachable"; detail: string };

export const OAUTH_UNSUPPORTED_MESSAGE =
  "This Phoenix server does not support OAuth login; use an API key.";

/**
 * Probe the RFC 8414 discovery document. One request settles both pre-flight
 * questions a login needs answered: is the server even up (a dead host fails
 * the fetch), and does it run the OAuth authorization server (a Phoenix
 * without one answers unknown paths with the SPA's index.html and a 200,
 * which is why only a parsing document counts as support).
 */
export async function discoverOAuthAuthorizationServer({
  endpoint,
  fetchImpl = fetch,
}: {
  endpoint: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthDiscoveryResult> {
  let response: Response;
  try {
    response = await fetchImpl(
      new URL(
        ".well-known/oauth-authorization-server",
        normalizeEndpoint(endpoint)
      ),
      { signal: AbortSignal.timeout(OAUTH_DISCOVERY_TIMEOUT_MS) }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        status: "unreachable",
        detail: `the server did not respond within ${
          OAUTH_DISCOVERY_TIMEOUT_MS / 1000
        }s`,
      };
    }
    return {
      status: "unreachable",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  // A 5xx is a health verdict, not a capability verdict: a server mid-restart
  // must not be reported as permanently lacking OAuth support.
  if (response.status >= 500) {
    return {
      status: "unreachable",
      detail: `the server responded with HTTP ${response.status}`,
    };
  }
  if (!response.ok) {
    return { status: "unsupported" };
  }
  let document: unknown;
  try {
    document = await response.json();
  } catch {
    return { status: "unsupported" };
  }
  return OAuthAuthorizationServerMetadataSchema.safeParse(document).success
    ? { status: "supported" }
    : { status: "unsupported" };
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface CallbackSuccess {
  status: "success";
  code: string;
}

export interface CallbackDenied {
  status: "access_denied";
}

export interface CallbackInvalid {
  status: "invalid";
  message: string;
}

export type CallbackParseResult =
  | CallbackSuccess
  | CallbackDenied
  | CallbackInvalid;

interface LoginCallbackResult {
  redirectUri: string;
  resultPromise: Promise<CallbackParseResult>;
  close: () => Promise<void>;
}

export function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export function generatePkcePair(): PkcePair {
  const verifier = base64Url(randomBytes(64));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return base64Url(randomBytes(32));
}

export function parseOAuthCallbackUrl({
  redirectUrl,
  expectedState,
}: {
  redirectUrl: string;
  expectedState: string;
}): CallbackParseResult {
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return { status: "invalid", message: "Invalid redirect URL." };
  }

  const state = url.searchParams.get("state");
  if (state !== expectedState) {
    return {
      status: "invalid",
      message: "OAuth state mismatch; possible CSRF.",
    };
  }

  const error = url.searchParams.get("error");
  if (error === "access_denied") {
    return { status: "access_denied" };
  }
  if (error) {
    return {
      status: "invalid",
      message: `OAuth authorization failed: ${error}`,
    };
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return {
      status: "invalid",
      message: "OAuth callback did not include a code.",
    };
  }
  return { status: "success", code };
}

export function buildAuthorizationUrl({
  endpoint,
  redirectUri,
  state,
  codeChallenge,
}: {
  endpoint: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const authorizationUrl = new URL(
    "oauth2/authorize",
    normalizeEndpoint(endpoint)
  );
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", OAUTH_CLIENT_ID);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  return authorizationUrl.toString();
}

export function normalizeEndpoint(endpoint: string): string {
  return endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
}

export function tokenResponseToOAuthTokens({
  response,
  now = new Date(),
}: {
  response: OAuthTokenEndpointResponse;
  now?: Date;
}): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: new Date(
      now.getTime() + response.expires_in * 1000
    ).toISOString(),
    scope: response.scope,
  };
}

export function isOAuthTokenExpiring({
  tokens,
  now = new Date(),
  bufferMs = OAUTH_REFRESH_BUFFER_MS,
}: {
  tokens: OAuthTokens;
  now?: Date;
  bufferMs?: number;
}): boolean {
  return Date.parse(tokens.expiresAt) - now.getTime() <= bufferMs;
}

async function startLoginCallbackServer({
  expectedState,
}: {
  expectedState: string;
}): Promise<LoginCallbackResult> {
  let resolveResult!: (result: CallbackParseResult) => void;
  const resultPromise = new Promise<CallbackParseResult>((resolve) => {
    resolveResult = resolve;
  });

  const server = http.createServer((request, response) => {
    // Parse against a fixed loopback base: the Host header is untrusted input,
    // and a malformed value would make the URL constructor throw inside the
    // request handler, crashing the CLI mid-login.
    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    } catch {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }
    if (requestUrl.pathname !== OAUTH_CALLBACK_PATH) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const result = parseOAuthCallbackUrl({
      redirectUrl: requestUrl.toString(),
      expectedState,
    });
    resolveResult(result);
    response.writeHead(result.status === "invalid" ? 400 : 200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(renderOAuthCallbackPage(result));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    await closeServer(server);
    throw new Error("Could not bind OAuth callback server.");
  }

  return {
    redirectUri: `http://127.0.0.1:${address.port}${OAUTH_CALLBACK_PATH}`,
    resultPromise,
    close: () => closeServer(server),
  };
}

interface PastedRedirectPrompt {
  resultPromise: Promise<CallbackParseResult>;
  /**
   * Release stdin. Must be called when the prompt loses the race to the
   * loopback callback — an open readline interface keeps the event loop
   * alive and the process would hang after a successful login.
   */
  close: () => void;
}

function waitForPastedRedirectUrl({
  expectedState,
  input = process.stdin,
  output = process.stderr,
}: {
  expectedState: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}): PastedRedirectPrompt {
  output.write("Paste the full redirect URL and press Enter: ");
  const reader = readline.createInterface({ input, output });
  const resultPromise = new Promise<CallbackParseResult>((resolve) => {
    reader.once("line", (line) => {
      reader.close();
      resolve(
        parseOAuthCallbackUrl({
          redirectUrl: line.trim(),
          expectedState,
        })
      );
    });
  });
  return { resultPromise, close: () => reader.close() };
}

function withTimeout<T>({
  promise,
  timeoutMs,
}: {
  promise: Promise<T>;
  timeoutMs: number;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new NetworkError("OAuth login timed out."));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export async function exchangeAuthorizationCode({
  endpoint,
  code,
  redirectUri,
  verifier,
  fetchImpl = fetch,
}: {
  endpoint: string;
  code: string;
  redirectUri: string;
  verifier: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokenEndpointResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: OAUTH_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  return postTokenRequest({ endpoint, body, fetchImpl });
}

export interface BrowserLoginFlowArgs {
  endpoint: string;
  /**
   * Called with the authorization URL before the browser opens, so the user
   * can complete the login by hand when the launch fails or goes unnoticed.
   */
  onAuthorizationUrl: (url: string) => void;
  /** False keeps the browser shut, leaving the pasted-URL lane (if allowed). */
  openBrowserWindow?: boolean;
  /** Narrates a failed launch; the pasted-redirect prompt is the fallback. */
  onBrowserOpenFailed?: (error: unknown) => void;
  /**
   * Accept a hand-pasted redirect URL when no browser was opened — the only
   * way to finish a login over SSH or in a container.
   */
  allowPastedRedirect?: boolean;
  /** Abandon the wait — the caller's escape hatch from an unanswered login. */
  signal?: AbortSignal;
}

export type BrowserLoginFlowResult =
  | { status: "success"; tokens: OAuthTokenEndpointResponse }
  /** The user declined consent, or abandoned the wait via `signal`. */
  | { status: "cancelled" }
  | { status: "invalid"; message: string };

/**
 * The Authorization Code + PKCE browser login, end to end: callback server,
 * browser launch, the wait, and the token exchange. Both `px auth login` (which
 * persists the tokens) and `px setup` (which spends the access token once to
 * mint an API key) drive it — the differences between them are the arguments
 * above, not a second copy of the sequence.
 */
export async function runBrowserLoginFlow({
  endpoint,
  onAuthorizationUrl,
  openBrowserWindow = true,
  onBrowserOpenFailed,
  allowPastedRedirect = false,
  signal,
}: BrowserLoginFlowArgs): Promise<BrowserLoginFlowResult> {
  // Bail before binding a port or launching a browser for a login the caller
  // has already given up on.
  if (signal?.aborted) {
    return { status: "cancelled" };
  }
  const pkce = generatePkcePair();
  const state = generateState();
  const callbackServer = await startLoginCallbackServer({
    expectedState: state,
  });
  let pastedRedirectPrompt: PastedRedirectPrompt | undefined;
  try {
    const authorizationUrl = buildAuthorizationUrl({
      endpoint,
      redirectUri: callbackServer.redirectUri,
      state,
      codeChallenge: pkce.challenge,
    });
    onAuthorizationUrl(authorizationUrl);

    let browserOpened = false;
    if (openBrowserWindow) {
      try {
        await openBrowser(authorizationUrl);
        browserOpened = true;
      } catch (error) {
        onBrowserOpenFailed?.(error);
      }
    }

    // Only when no browser opened: otherwise the prompt would hold stdin for a
    // login the browser is about to complete on its own.
    pastedRedirectPrompt =
      allowPastedRedirect && !browserOpened
        ? waitForPastedRedirectUrl({ expectedState: state })
        : undefined;

    const races: Promise<CallbackParseResult | "aborted">[] = [
      callbackServer.resultPromise,
    ];
    if (pastedRedirectPrompt !== undefined) {
      races.push(pastedRedirectPrompt.resultPromise);
    }
    if (signal !== undefined) {
      races.push(abortedPromise(signal));
    }
    const callbackResult = await withTimeout({
      promise: Promise.race(races),
      timeoutMs: OAUTH_LOGIN_TIMEOUT_MS,
    });

    if (
      callbackResult === "aborted" ||
      callbackResult.status === "access_denied"
    ) {
      return { status: "cancelled" };
    }
    if (callbackResult.status === "invalid") {
      return { status: "invalid", message: callbackResult.message };
    }

    const tokens = await exchangeAuthorizationCode({
      endpoint,
      code: callbackResult.code,
      redirectUri: callbackServer.redirectUri,
      verifier: pkce.verifier,
    });
    return { status: "success", tokens };
  } finally {
    // Release stdin when the loopback callback won the race — an open readline
    // interface would keep the process alive after success.
    pastedRedirectPrompt?.close();
    await callbackServer.close();
  }
}

/** Resolves — never rejects — so it can lose a `Promise.race` harmlessly. */
function abortedPromise(signal: AbortSignal): Promise<"aborted"> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve("aborted");
      return;
    }
    signal.addEventListener("abort", () => resolve("aborted"), { once: true });
  });
}

export async function refreshOAuthToken({
  endpoint,
  refreshToken,
  fetchImpl = fetch,
}: {
  endpoint: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokenEndpointResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: OAUTH_CLIENT_ID,
    refresh_token: refreshToken,
  });
  return postTokenRequest({ endpoint, body, fetchImpl });
}

async function postTokenRequest({
  endpoint,
  body,
  fetchImpl,
}: {
  endpoint: string;
  body: URLSearchParams;
  fetchImpl: typeof fetch;
}): Promise<OAuthTokenEndpointResponse> {
  let response: Response;
  try {
    response = await fetchImpl(
      new URL("oauth2/token", normalizeEndpoint(endpoint)),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(OAUTH_TOKEN_REQUEST_TIMEOUT_MS),
      }
    );
  } catch (error) {
    // A bare AbortError/DOMException is neither actionable nor mapped to an
    // exit code by the callers, which recognize NetworkError.
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new NetworkError(
        `The OAuth token endpoint at ${endpoint} did not respond within ${
          OAUTH_TOKEN_REQUEST_TIMEOUT_MS / 1000
        }s.`
      );
    }
    throw error;
  }

  if (response.status === 404) {
    throw new AuthRequiredError(OAUTH_UNSUPPORTED_MESSAGE);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new AuthRequiredError(
      text || `OAuth token exchange failed with HTTP ${response.status}.`
    );
  }

  const json: unknown = await response.json();
  return OAuthTokenEndpointResponseSchema.parse(json);
}

export async function revokeOAuthToken({
  endpoint,
  refreshToken,
  fetchImpl = fetch,
}: {
  endpoint: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const body = new URLSearchParams({
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
  await fetchImpl(new URL("oauth2/revoke", normalizeEndpoint(endpoint)), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(OAUTH_REVOKE_TIMEOUT_MS),
  });
}

export async function refreshOAuthTokensForProfile({
  endpoint,
  profileName,
  currentTokens,
  force = false,
  settingsPath = getSettingsPath(),
  fetchImpl = fetch,
}: {
  endpoint: string;
  profileName: string;
  currentTokens: OAuthTokens;
  force?: boolean;
  settingsPath?: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokens> {
  return withSettingsLock(settingsPath, async () => {
    const settings = loadSettings({ strict: true, settingsPath });
    const profile = getProfileByName(settings, profileName);
    const latestTokens = profile?.entry.oauthTokens ?? currentTokens;
    if (!force && !isOAuthTokenExpiring({ tokens: latestTokens })) {
      return latestTokens;
    }

    const response = await refreshOAuthToken({
      endpoint,
      refreshToken: latestTokens.refreshToken,
      fetchImpl,
    });
    const rotatedTokens = tokenResponseToOAuthTokens({ response });
    if (!profile) {
      return rotatedTokens;
    }
    const updatedSettings: SettingsFile = {
      ...settings,
      profiles: {
        ...settings.profiles,
        [profileName]: {
          ...profile.entry,
          oauthTokens: rotatedTokens,
        },
      },
    };
    saveSettings(updatedSettings, { settingsPath });
    return rotatedTokens;
  });
}

export function resolveTargetProfileName(
  settings: SettingsFile,
  explicit?: string
): string {
  if (explicit !== undefined) {
    return explicit;
  }
  return getStoredActiveProfile(settings)?.name ?? "default";
}

export async function withSettingsLock<T>(
  settingsPath: string,
  action: () => Promise<T>
): Promise<T> {
  const lockPath = `${settingsPath}.lock`;
  const startedAt = Date.now();
  let descriptor: number | undefined;

  while (descriptor === undefined) {
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });
      descriptor = fs.openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        (error as NodeJS.ErrnoException).code !== "EEXIST"
      ) {
        throw error;
      }
      // A lock left behind by a killed process would otherwise block every
      // future settings write; steal it once it is older than the timeout.
      if (isLockStale(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // Another process stole it first; retry the open.
        }
        continue;
      }
      if (Date.now() - startedAt >= SETTINGS_LOCK_TIMEOUT_MS) {
        throw new Error(
          `Timed out waiting for the settings lock at ${lockPath}. ` +
            "If no other px process is running, delete the file and retry."
        );
      }
      await sleep(SETTINGS_LOCK_RETRY_MS);
    }
  }

  try {
    return await action();
  } finally {
    fs.closeSync(descriptor);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // Another process may have cleaned up the lock after the refresh was persisted.
    }
  }
}

function isLockStale(lockPath: string): boolean {
  try {
    return (
      Date.now() - fs.statSync(lockPath).mtimeMs > SETTINGS_LOCK_TIMEOUT_MS
    );
  } catch {
    // The lock disappeared; the next open attempt will settle it.
    return false;
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
