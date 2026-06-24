import {
  DEFAULT_PHOENIX_BASE_URL,
  getEnvironmentConfig,
} from "@arizeai/phoenix-config";

export type ResolvedConfig = {
  /** Base URL of the Phoenix server, without a trailing slash. */
  baseUrl: string;
  /** Headers to send with every request (auth + any custom client headers). */
  headers: Record<string, string>;
};

/**
 * Resolve the Phoenix connection settings, using `@arizeai/phoenix-config` for
 * environment resolution so the CLI honours the same env vars as the rest of
 * the Phoenix tooling. Explicit CLI options take precedence over the
 * environment, which takes precedence over the built-in default host.
 */
export function resolveConfig(options: {
  host?: string;
  apiKey?: string;
}): ResolvedConfig {
  const env = getEnvironmentConfig();
  const baseUrl = (
    options.host ??
    env.PHOENIX_HOST ??
    DEFAULT_PHOENIX_BASE_URL
  ).replace(/\/+$/, "");
  const apiKey = options.apiKey ?? env.PHOENIX_API_KEY;
  const headers: Record<string, string> = {
    ...(env.PHOENIX_CLIENT_HEADERS ?? {}),
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return { baseUrl, headers };
}

/**
 * Build the URL for the direct server-agent chat endpoint:
 * `POST /agents/server/sessions/{session_id}/chat`. `server` is a literal path
 * segment (see `run_server_agent` in the Phoenix server); only the session id
 * is interpolated.
 */
export function buildServerAgentChatUrl(
  baseUrl: string,
  sessionId: string
): string {
  return `${baseUrl.replace(/\/+$/, "")}/agents/server/sessions/${encodeURIComponent(sessionId)}/chat`;
}
