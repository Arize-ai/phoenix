/**
 * Secret scrubbing for all surfaced subprocess / HTTP error text.
 * Applied before anything from an external process or response body reaches
 * the terminal.
 */

const MAX_SURFACED_LENGTH = 500;

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g;
const API_KEY_ASSIGNMENT_PATTERN = /(PHOENIX_API_KEY\s*[=:]\s*)\S+/g;
// JWT: three dot-separated base64url segments.
const JWT_PATTERN = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
// Long bare base64url runs that look like tokens.
const LONG_TOKEN_PATTERN = /[A-Za-z0-9_-]{32,}/g;

export function redact(text: string): string {
  return text
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .replace(API_KEY_ASSIGNMENT_PATTERN, "$1[REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED]")
    .replace(LONG_TOKEN_PATTERN, "[REDACTED]");
}

/**
 * Redact then truncate for display. All error text from probes, HTTP
 * responses, and subprocesses goes through this before being shown.
 */
export function redactForDisplay(text: string): string {
  const scrubbed = redact(text).trim();
  if (scrubbed.length <= MAX_SURFACED_LENGTH) {
    return scrubbed;
  }
  return `${scrubbed.slice(0, MAX_SURFACED_LENGTH)}…`;
}
