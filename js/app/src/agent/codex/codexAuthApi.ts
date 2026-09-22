/**
 * Browser side of the ChatGPT (Codex subscription) sign-in.
 *
 * Experimental. The device-code flow and every token live in this browser;
 * the server routes under `/v1/codex` are stateless pass-throughs to
 * `auth.openai.com` (which the browser cannot call directly because of CORS).
 */

import type { components, paths } from "@phoenix/api/__generated__/v1";
import { authFetch } from "@phoenix/authFetch";
import type { AgentStore, CodexAuth } from "@phoenix/store/agentStore";
import { prependBasename } from "@phoenix/utils/routingUtils";

const DEVICE_AUTH_PATH = "/v1/codex/device_auth" satisfies keyof paths;
const DEVICE_AUTH_POLL_PATH =
  "/v1/codex/device_auth/poll" satisfies keyof paths;
const REFRESH_PATH = "/v1/codex/refresh" satisfies keyof paths;
const MODELS_PATH = "/v1/codex/models" satisfies keyof paths;

export type CodexDeviceAuthStart =
  components["schemas"]["CodexDeviceAuthStartResponseBody"];
type CodexTokenBundle = components["schemas"]["CodexTokenBundle"];
type CodexDeviceAuthPoll =
  components["schemas"]["CodexDeviceAuthPollResponseBody"];

const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

export class CodexAuthApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CodexAuthApiError";
    this.status = status;
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

export function toCodexAuth(bundle: CodexTokenBundle): CodexAuth {
  return {
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
    idToken: bundle.idToken ?? null,
    accountId: bundle.accountId,
    expiresAt: readJwtExpiresAt(bundle.accessToken),
  };
}

export function startCodexDeviceAuth(): Promise<CodexDeviceAuthStart> {
  return postJson<CodexDeviceAuthStart>(DEVICE_AUTH_PATH, {});
}

export async function pollCodexDeviceAuth(params: {
  deviceAuthId: string;
  userCode: string;
}): Promise<CodexAuth | null> {
  const result = await postJson<CodexDeviceAuthPoll>(
    DEVICE_AUTH_POLL_PATH,
    params
  );
  return result.status === "complete" && result.tokens
    ? toCodexAuth(result.tokens)
    : null;
}

export async function refreshCodexAuth(
  refreshToken: string
): Promise<CodexAuth> {
  const bundle = await postJson<CodexTokenBundle>(REFRESH_PATH, {
    refreshToken,
  });
  return toCodexAuth(bundle);
}

export async function listCodexModels(accessToken: string): Promise<string[]> {
  const result = await postJson<
    components["schemas"]["CodexModelsResponseBody"]
  >(MODELS_PATH, { accessToken });
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
      if (error instanceof CodexAuthApiError && error.status === 401) {
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
