import type { ProblemDetail } from "@arizeai/phoenix-client";

import { writeError } from "./io";

/**
 * Structured error envelope written to stderr when `--format json|raw` is
 * active. Lets agents parse the failure mode without scraping a
 * human-readable message.
 *
 * Shape:
 *   { error: string, code: string, hint?: string, status?: number,
 *     problem_code?: string, problem_reason?: string, existing_id?: string,
 *     problem?: ProblemDetail }
 *
 * `code` is the `ExitCode` constant *name* (e.g. "INVALID_ARGUMENT", not the
 * numeric code), and `hint` SHOULD be a copy-pasteable command that resolves
 * the problem when one is available. `problem_code` and `problem_reason` are
 * shortcuts to the server's own `code` (e.g. "already_exists") and `reason`
 * (a finer condition under it, e.g. "still_bound"); `problem` is the full
 * parsed body, every member included, for a recovery field this envelope
 * doesn't shortcut on its own (e.g. `binding_counts`).
 */
export interface StructuredError {
  error: string;
  code: string;
  hint?: string;
  /** HTTP status of a failed API request. */
  status?: number;
  /** The server's own machine-readable code, e.g. "already_exists". */
  problem_code?: string;
  /** A finer condition under problem_code, e.g. "still_bound". */
  problem_reason?: string;
  /** For "already_exists": the GlobalID of the resource that holds the name. */
  existing_id?: string;
  /** The full parsed problem body, every member included. */
  problem?: ProblemDetail;
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
  /** HTTP status, the server's code and reason, and existing resource of a failed request. */
  status?: number;
  problemCode?: string;
  problemReason?: string;
  existingId?: string;
  /** The full parsed problem body, every member included. */
  problem?: ProblemDetail;
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
  status,
  problemCode,
  problemReason,
  existingId,
  problem,
}: WriteStructuredErrorOptions): void {
  const mode = format ?? "pretty";
  if (mode === "json" || mode === "raw") {
    const envelope: StructuredError = {
      error: message,
      code,
      ...(hint !== undefined && { hint }),
      ...(status !== undefined && { status }),
      ...(problemCode !== undefined && { problem_code: problemCode }),
      ...(problemReason !== undefined && { problem_reason: problemReason }),
      ...(existingId !== undefined && { existing_id: existingId }),
      ...(problem !== undefined && { problem }),
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
