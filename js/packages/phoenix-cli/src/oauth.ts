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
export const OAUTH_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
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

export interface LoginCallbackResult {
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

export async function startLoginCallbackServer({
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

export interface PastedRedirectPrompt {
  resultPromise: Promise<CallbackParseResult>;
  /**
   * Release stdin. Must be called when the prompt loses the race to the
   * loopback callback — an open readline interface keeps the event loop
   * alive and the process would hang after a successful login.
   */
  close: () => void;
}

export function waitForPastedRedirectUrl({
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

export function withTimeout<T>({
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

export async function openBrowser(url: string): Promise<void> {
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
  const response = await fetchImpl(
    new URL("oauth2/token", normalizeEndpoint(endpoint)),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (response.status === 404) {
    throw new AuthRequiredError(
      "This Phoenix server does not support OAuth login; use an API key."
    );
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
