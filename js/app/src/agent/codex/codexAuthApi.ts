/**
 * Browser side of the ChatGPT (Codex subscription) sign-in.
 *
 * Experimental. Every token lives in this browser; the server routes under
 * `/codex` relay the OAuth 2.0 Device Authorization Grant (RFC 8628) to
 * `auth.openai.com`, which the browser cannot call directly because of CORS.
 */

import type { components, paths } from "@phoenix/api/__generated__/v1";
import { authFetch } from "@phoenix/authFetch";
import type { AgentStore, CodexAuth } from "@phoenix/store/agentStore";
import { prependBasename } from "@phoenix/utils/routingUtils";

const DEVICE_AUTHORIZATION_PATH =
  "/codex/device_authorization" satisfies keyof paths;
const TOKEN_PATH = "/codex/token" satisfies keyof paths;
const MODELS_PATH = "/codex/models" satisfies keyof paths;

const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_TOKEN_GRANT_TYPE = "refresh_token";

export type CodexDeviceAuthorization =
  components["schemas"]["CodexDeviceAuthorizationResponse"];
type CodexTokenResponse = components["schemas"]["CodexTokenResponse"];
type CodexTokenErrorResponse = components["schemas"]["CodexTokenErrorResponse"];
type CodexTokenErrorCode = CodexTokenErrorResponse["error"];
type CodexTokenRequest = components["schemas"]["Body_codexToken"];

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await authFetch(prependBasename(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
 * `error` code, which is surfaced on the thrown {@link CodexAuthApiError}.
 */
async function postTokenRequest(
  form: CodexTokenRequest
): Promise<CodexTokenResponse> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value != null) {
      body.set(key, value);
    }
  }
  const response = await authFetch(prependBasename(TOKEN_PATH), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
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

/** Unverified JWT `exp` claim as unix ms, or null. A hint, not an authority. */
export function readJwtExpiresAt(token: string): number | null {
  const segment = token.split(".")[1];
  if (!segment) {
    return null;
  }
  try {
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const payload = JSON.parse(
      atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function toCodexAuth(tokens: CodexTokenResponse): CodexAuth {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token ?? null,
    accountId: tokens.account_id,
    expiresAt: readJwtExpiresAt(tokens.access_token),
  };
}

export function startCodexDeviceAuthorization(): Promise<CodexDeviceAuthorization> {
  return postJson<CodexDeviceAuthorization>(DEVICE_AUTHORIZATION_PATH, {});
}

/**
 * One RFC 8628 §3.4 token request. Resolves to `null` while the user has
 * not finished signing in (`authorization_pending`) and throws once the
 * grant is rejected or expired.
 */
export async function pollCodexDeviceAuthorization(
  deviceCode: string
): Promise<CodexAuth | null> {
  try {
    const tokens = await postTokenRequest({
      grant_type: DEVICE_CODE_GRANT_TYPE,
      device_code: deviceCode,
    });
    return toCodexAuth(tokens);
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

export async function refreshCodexAuth(
  refreshToken: string
): Promise<CodexAuth> {
  const tokens = await postTokenRequest({
    grant_type: REFRESH_TOKEN_GRANT_TYPE,
    refresh_token: refreshToken,
  });
  return toCodexAuth(tokens);
}

export async function listCodexModels(accessToken: string): Promise<string[]> {
  const result = await postJson<
    components["schemas"]["CodexModelsResponseBody"]
  >(MODELS_PATH, { access_token: accessToken });
  return result.models;
}

export function isCodexAuthStale(
  codexAuth: CodexAuth,
  now: number = Date.now()
): boolean {
  return (
    codexAuth.expiresAt != null &&
    codexAuth.expiresAt - REFRESH_LEEWAY_MS <= now
  );
}

let inflightRefresh: Promise<CodexAuth | null> | null = null;

/**
 * Single-flight: refresh tokens are single-use, so two concurrent refreshes
 * would invalidate each other. Only a rejected grant clears the sign-in; a
 * transport failure keeps the current credentials, since the server reports a
 * real 401 if they are in fact unusable.
 */
export function ensureFreshCodexAuth(
  store: AgentStore
): Promise<CodexAuth | null> {
  const current = store.getState().codexAuth;
  if (current == null || !isCodexAuthStale(current)) {
    return Promise.resolve(current);
  }
  if (inflightRefresh) {
    return inflightRefresh;
  }
  inflightRefresh = (async () => {
    try {
      const refreshed = await refreshCodexAuth(current.refreshToken);
      store.getState().setCodexAuth(refreshed);
      return refreshed;
    } catch (error) {
      if (
        error instanceof CodexAuthApiError &&
        error.code === "invalid_grant"
      ) {
        store.getState().setCodexAuth(null);
        return null;
      }
      return current;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}
