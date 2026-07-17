/**
 * Client-side helpers for temporary chat session expiry.
 */

/**
 * Error thrown when the chat endpoint reports that the session no longer
 * exists — expired, swept, or deleted elsewhere.
 */
export class AgentSessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
    this.name = "AgentSessionNotFoundError";
  }
}

export function isAgentSessionNotFoundError(error: unknown): boolean {
  return error instanceof AgentSessionNotFoundError;
}

/**
 * Converts the server's relative `expiresIn` (seconds) into a local
 * wall-clock deadline (ms since epoch).
 */
export function computeLocalExpiresAt(
  expiresIn: number | null | undefined
): number | null {
  return expiresIn != null ? Date.now() + expiresIn * 1000 : null;
}
