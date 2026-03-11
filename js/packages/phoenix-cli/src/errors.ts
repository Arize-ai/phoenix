/**
 * Thrown when the server returns HTTP 401 or 403.
 * Commands should catch this and exit with EXIT_CODES.AUTH_REQUIRED (4).
 */
export class AuthRequiredError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Authentication required or insufficient permissions. Set PHOENIX_API_KEY or use --api-key."
    );
    this.name = "AuthRequiredError";
  }
}

/**
 * Thrown when the user cancels an interactive prompt.
 * Commands should catch this and exit with EXIT_CODES.CANCELLED (2).
 */
export class UserCancelledError extends Error {
  constructor(message?: string) {
    super(message ?? "Operation cancelled by user.");
    this.name = "UserCancelledError";
  }
}

/**
 * Check an HTTP Response for 401/403 and throw AuthRequiredError if found.
 * Call this before throwing a generic error so callers can distinguish auth failures.
 */
export function throwIfAuthError(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new AuthRequiredError(
      `Authentication required (HTTP ${response.status}). Configure PHOENIX_API_KEY or use --api-key.`
    );
  }
}
