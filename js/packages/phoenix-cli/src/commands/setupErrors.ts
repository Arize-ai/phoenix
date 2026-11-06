/**
 * The setup commands' shared failure funnel. Every `px setup` lane and
 * subcommand exits through here, so a cancelled prompt, a bad headless
 * invocation, and a fatal step keep their distinct exit codes — and a
 * `--format json|raw` caller gets the same `{error, code, hint}` envelope
 * every other px command gives it, instead of a bare line on stderr.
 */

import { ExitCode, getExitCodeForError } from "../exitCodes";
import * as COPY from "../setup/copy";
import {
  HeadlessInputError,
  SetupCancelledError,
  SetupFatalError,
} from "../setup/errors";
import { writeStructuredError } from "../structuredError";
import type { OutputFormat } from "./formatSetup";

/** The envelope `code` is the ExitCode constant *name* the number maps to. */
function exitCodeName(code: ExitCode): string {
  switch (code) {
    case ExitCode.INVALID_ARGUMENT:
      return "INVALID_ARGUMENT";
    case ExitCode.AUTH_REQUIRED:
      return "AUTH_REQUIRED";
    case ExitCode.NETWORK_ERROR:
      return "NETWORK_ERROR";
    default:
      return "FAILURE";
  }
}

export function exitWithError(error: unknown, format: OutputFormat): never {
  if (error instanceof SetupCancelledError) {
    writeStructuredError({
      format,
      message: COPY.CANCEL_OUTRO,
      code: "CANCELLED",
    });
    process.exit(ExitCode.CANCELLED);
  }
  if (error instanceof HeadlessInputError) {
    writeStructuredError({
      format,
      message: error.message,
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
  if (error instanceof SetupFatalError) {
    writeStructuredError({ format, message: error.message, code: "FAILURE" });
    process.exit(ExitCode.FAILURE);
  }
  const exitCode = getExitCodeForError(error);
  writeStructuredError({
    format,
    message: String(error),
    code: exitCodeName(exitCode),
  });
  process.exit(exitCode);
}
