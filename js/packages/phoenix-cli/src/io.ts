/**
 * Console I/O helpers for the CLI.
 *
 * These are intentionally generic (not entity-specific). Formatting lives with commands.
 */

/**
 * Write data output to stdout.
 */
export interface WriteOutputOptions {
  /**
   * Message to write to stdout.
   */
  message: string;
}

/**
 * Write data output to stdout.
 */
export function writeOutput({ message }: WriteOutputOptions): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

/**
 * Write errors/warnings to stderr.
 */
export interface WriteErrorOptions {
  /**
   * Message to write to stderr.
   */
  message: string;
}

/**
 * Write errors/warnings to stderr.
 */
export function writeError({ message }: WriteErrorOptions): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

/**
 * Write progress indicators to stderr (optional).
 */
export interface WriteProgressOptions {
  /**
   * Progress message to write to stderr.
   */
  message: string;
  /**
   * When true, suppresses progress output.
   */
  noProgress?: boolean;
}

/**
 * Write progress indicators to stderr (optional).
 */
export function writeProgress({
  message,
  noProgress,
}: WriteProgressOptions): void {
  if (!noProgress) {
    // eslint-disable-next-line no-console
    console.error(message);
  }
}
