/**
 * Semantic exit codes for the Phoenix CLI.
 *
 * These codes enable scripting and CI integration by providing
 * machine-readable signals for different outcomes.
 */
export const EXIT_CODES = {
  /** Command completed successfully. */
  SUCCESS: 0,
  /** General failure (configuration errors, API errors, unexpected conditions). */
  FAILURE: 1,
  /** Operation cancelled by the user (e.g., declined a confirmation prompt). */
  CANCELLED: 2,
  /** Authentication required or insufficient permissions (HTTP 401/403). */
  AUTH_REQUIRED: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
