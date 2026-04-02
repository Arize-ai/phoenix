import * as readline from "readline";
import { ExitCode } from "./exitCodes.js";

/**
 * Prompt the user with a yes/no question via stderr.
 *
 * Returns `true` if the user answered "y" or "yes" (case-insensitive),
 * `false` otherwise.
 */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
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
