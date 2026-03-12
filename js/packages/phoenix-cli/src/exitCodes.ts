/**
 * Semantic exit codes for the Phoenix CLI.
 *
 * These codes enable scripting and CI integration by providing meaningful
 * signals about why a command failed. Consumers can use these codes in shell
 * scripts or CI pipelines to distinguish between different failure modes.
 *
 * | Code | Meaning          | Description                                         |
 * |------|------------------|-----------------------------------------------------|
 * |  0   | Success          | Command completed successfully                      |
 * |  1   | Failure          | Unspecified or unexpected error                     |
 * |  2   | Cancelled        | User cancelled (e.g. declined a confirmation)       |
 * |  3   | Invalid argument | Bad CLI flags, missing required args, invalid input |
 * |  4   | Auth required    | Not authenticated or insufficient permissions       |
 * |  5   | Network error    | Failed to connect to server or network request      |
 */
export const ExitCode = {
  /** Command completed successfully */
  SUCCESS: 0,
  /** Unspecified or unexpected error */
  FAILURE: 1,
  /** User cancelled the operation */
  CANCELLED: 2,
  /** Bad CLI flags, missing required args, or invalid input */
  INVALID_ARGUMENT: 3,
  /** Not authenticated or insufficient permissions */
  AUTH_REQUIRED: 4,
  /** Failed to connect to server or network request failed */
  NETWORK_ERROR: 5,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Infer a semantic exit code from an unknown error value.
 *
 * The Fetch API throws a `TypeError` for low-level network failures such as
 * connection refused or DNS resolution errors. All other errors fall back to
 * the general {@link ExitCode.FAILURE} code.
 */
export function getExitCodeForError(error: unknown): ExitCode {
  // TypeError is thrown by the Fetch API for network-level failures
  // (e.g. ECONNREFUSED, ETIMEDOUT, DNS errors).
  if (error instanceof TypeError) {
    return ExitCode.NETWORK_ERROR;
  }
  return ExitCode.FAILURE;
}
