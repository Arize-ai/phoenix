/**
 * Client-side helpers for temporary chat session expiry.
 *
 * The server expresses expiry over the wire as a relative `expiresIn`
 * (seconds) rather than an absolute timestamp so server/client clock skew
 * never affects when the client considers a session expired. The relative
 * value is only meaningful at the moment it is received, so it must be
 * converted to a local deadline immediately and never stored raw.
 */

/**
 * Error thrown when the chat endpoint reports that the session no longer
 * exists — expired, swept, or deleted elsewhere.
 */
export class AgentSessionGoneError extends Error {
  constructor() {
    super("Session not found");
    this.name = "AgentSessionGoneError";
  }
}

/**
 * The chat route responds 404 with this detail for a missing, expired, or
 * foreign session; matching on it is the fallback when the transport
 * surfaces the raw response body instead of the typed error.
 */
const SESSION_NOT_FOUND_DETAIL = "Session not found";

export function isAgentSessionGoneError(error: unknown): boolean {
  return (
    error instanceof AgentSessionGoneError ||
    (error instanceof Error && error.message.includes(SESSION_NOT_FOUND_DETAIL))
  );
}

/**
 * Converts the server's relative `expiresIn` (seconds) into a local
 * wall-clock deadline (ms since epoch). Call at the moment the value is
 * received.
 */
export function computeLocalExpiresAt(
  expiresIn: number | null | undefined
): number | null {
  return expiresIn != null ? Date.now() + expiresIn * 1000 : null;
}
