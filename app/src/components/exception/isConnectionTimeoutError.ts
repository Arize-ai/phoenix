/**
 * Patterns that indicate a connection timeout error.
 *
 * When a load balancer or proxy times out before the server can respond,
 * it typically returns an HTML error page (e.g., 502, 504). When the app
 * tries to parse this HTML as JSON, it throws an error like:
 * - Chrome: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
 * - Firefox: `JSON.parse: unexpected character at line 1 column 1 of the JSON data`
 *
 * These patterns help detect such scenarios.
 */
const CONNECTION_TIMEOUT_PATTERNS = [
  // Chrome/Safari/Edge pattern when trying to parse HTML as JSON
  /Unexpected token ['"]?<['"]?/i,
  // Firefox pattern when trying to parse HTML as JSON
  /JSON\.parse.*unexpected character/i,
  // Generic patterns for HTML response instead of JSON
  /<!DOCTYPE/i,
  // Network-level timeouts
  /timeout/i,
  // Gateway errors that may appear in error messages
  /502|504|gateway/i,
] as const;

/**
 * Detects if an error is likely a connection timeout error.
 *
 * This happens when a load balancer or proxy returns an HTML error page
 * (e.g., 502 Bad Gateway, 504 Gateway Timeout) instead of the expected
 * JSON response, and the JSON parser fails.
 *
 * @param error - The error to check (can be Error, string, or null/undefined)
 * @returns true if the error matches connection timeout patterns
 */
export function isConnectionTimeoutError(
  error: Error | string | null | undefined
): boolean {
  if (error == null) {
    return false;
  }

  const errorMessage = error instanceof Error ? error.message : error;

  if (typeof errorMessage !== "string" || errorMessage.length === 0) {
    return false;
  }

  return CONNECTION_TIMEOUT_PATTERNS.some((pattern) =>
    pattern.test(errorMessage)
  );
}
