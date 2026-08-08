/**
 * Typed errors for setup.
 *
 * `SetupCancelledError` is thrown by the prompter whenever the user cancels
 * (Ctrl-C / Escape on any prompt) and unwinds the whole of setup to a single
 * catch site in the command handler, which prints the support outro and
 * exits with `ExitCode.CANCELLED`.
 */

export class SetupCancelledError extends Error {
  constructor() {
    super("Setup cancelled by user");
    this.name = "SetupCancelledError";
  }
}

/**
 * Thrown when input supplied via flags or environment variables is missing
 * (headless mode) or invalid (any mode). Carries the exact remediation text
 * so the command handler can print it and exit `INVALID_ARGUMENT`.
 */
export class HeadlessInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeadlessInputError";
  }
}

/**
 * Thrown when a step fails in a way setup cannot recover from
 * (e.g. headless dirty git tree). Exits `FAILURE`.
 */
export class SetupFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupFatalError";
  }
}
