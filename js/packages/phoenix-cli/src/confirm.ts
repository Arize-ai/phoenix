import { cancel, confirm, isCancel } from "@clack/prompts";

import { ExitCode, InvalidArgumentError } from "./exitCodes.js";

export const ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES =
  "PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES";

/**
 * Prompt the user with a yes/no question.
 *
 * Returns `true` if the user confirms, `false` otherwise.
 */
export function confirmAction(message: string): Promise<boolean> {
  return confirm({
    message,
    initialValue: false,
    active: "Yes",
    inactive: "No",
  }).then((value) => {
    if (isCancel(value)) {
      cancel("Operation cancelled");
      return false;
    }

    return value;
  });
}

export interface ConfirmOrExitOptions {
  /**
   * The confirmation message to display to the user.
   */
  message: string;
  /**
   * When `true`, skips the prompt and proceeds without confirmation.
   */
  yes?: boolean;
}

interface ParseBooleanEnvironmentVariableOptions {
  /**
   * The name of the environment variable to read.
   */
  envVar: string;
  /**
   * The value to return when the variable is not set.
   */
  defaultValue?: boolean;
}

/**
 * Parse a boolean environment variable using Phoenix backend semantics.
 *
 * Accepted values are `true` and `false` in any casing. Unset variables return
 * `defaultValue`.
 */
export function parseBooleanEnvironmentVariable({
  envVar,
  defaultValue,
}: ParseBooleanEnvironmentVariableOptions): boolean | undefined {
  const value = process.env[envVar];
  if (value === undefined) {
    return defaultValue;
  }

  const normalizedValue = value.toLowerCase();
  if (normalizedValue === "true") {
    return true;
  }
  if (normalizedValue === "false") {
    return false;
  }

  throw new InvalidArgumentError(
    `${envVar} must be set to TRUE or FALSE (case-insensitive). Got: ${value}`
  );
}

/**
 * Block delete commands unless explicitly enabled via environment variable.
 */
export function assertDeletesEnabled(): void {
  const areDeletesEnabled = parseBooleanEnvironmentVariable({
    envVar: ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
    defaultValue: false,
  });

  if (areDeletesEnabled) {
    return;
  }

  throw new InvalidArgumentError("Delete commands are disabled.");
}

/**
 * Prompt the user for confirmation and exit the process if they decline.
 *
 * - If `yes` is `true`, skips the prompt entirely.
 * - If stdin is not a TTY and `yes` is not set, exits with `INVALID_ARGUMENT` (3).
 * - If the user declines, exits with `CANCELLED` (2).
 */
export async function confirmOrExit({
  message,
  yes,
}: ConfirmOrExitOptions): Promise<void> {
  if (yes) {
    return;
  }

  if (!process.stdin.isTTY) {
    process.stderr.write(
      `Error: stdin is not a TTY. Use --yes to skip confirmation.\n`
    );
    process.exit(ExitCode.INVALID_ARGUMENT);
  }

  const confirmed = await confirmAction(message);
  if (!confirmed) {
    process.exit(ExitCode.CANCELLED);
  }
}
