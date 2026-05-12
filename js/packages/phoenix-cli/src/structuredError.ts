import { writeError } from "./io";

/**
 * Structured error envelope written to stderr when `--format json|raw` is
 * active. Lets agents parse the failure mode without scraping a
 * human-readable message.
 *
 * Shape:
 *   { error: string, code: string, hint?: string }
 *
 * `code` is the `ExitCode` constant *name* (e.g. "INVALID_ARGUMENT", not the
 * numeric code), and `hint` SHOULD be a copy-pasteable command that resolves
 * the problem when one is available.
 */
export interface StructuredError {
  error: string;
  code: string;
  hint?: string;
}

export interface WriteStructuredErrorOptions {
  /** Active `--format` mode. Pretty mode emits a plain message; json/raw emit the JSON envelope. */
  format: "pretty" | "json" | "raw" | undefined;
  /** Human-readable error message — used both for pretty mode and the JSON `error` field. */
  message: string;
  /** ExitCode constant *name* — e.g. "INVALID_ARGUMENT". */
  code: string;
  /** Optional copy-pasteable resolution hint. */
  hint?: string;
}

/**
 * Write either a plain message (pretty mode) or a `StructuredError` JSON
 * envelope (json/raw mode) to stderr. The matching `process.exit(...)` is
 * the caller's responsibility — this helper does not exit.
 */
export function writeStructuredError({
  format,
  message,
  code,
  hint,
}: WriteStructuredErrorOptions): void {
  const mode = format ?? "pretty";
  if (mode === "json" || mode === "raw") {
    const envelope: StructuredError = {
      error: message,
      code,
      ...(hint !== undefined && { hint }),
    };
    writeError({
      message:
        mode === "raw"
          ? JSON.stringify(envelope)
          : JSON.stringify(envelope, null, 2),
    });
    return;
  }
  // Pretty mode — emit the human-readable message and the hint on a separate
  // line if present.
  writeError({ message: hint ? `${message}\n  Hint: ${hint}` : message });
}
