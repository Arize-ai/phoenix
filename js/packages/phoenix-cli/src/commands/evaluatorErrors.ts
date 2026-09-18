import { formatApiError, HttpError } from "@arizeai/phoenix-client";

import {
  ExitCode,
  exitCodeName,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeStructuredError } from "../structuredError";
import type { OutputFormat } from "./formatEvaluator";

const MAX_DETAIL_LENGTH = 500;

/**
 * Describe a failure for the terminal, including the server's explanation.
 *
 * The client throws `HttpError` with only the status line; the useful part of
 * a 409 (which bindings conflict) or a 422 (what was invalid) is in the body.
 */
export async function describeError(error: unknown): Promise<string> {
  if (error instanceof HttpError) {
    const detail = await readDetail(error);
    return `HTTP ${error.status} ${error.statusText}${detail ? `: ${detail}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function readDetail(error: HttpError): Promise<string> {
  let text: string;
  try {
    text = await error.response.clone().text();
  } catch {
    return "";
  }
  let detail = text.trim();
  if (
    error.response.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      detail = formatApiError(JSON.parse(text));
    } catch {
      // Not JSON after all: keep the raw text.
    }
  }
  return detail.length > MAX_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_DETAIL_LENGTH)}…`
    : detail;
}

/**
 * Report a failed command on stderr and exit with the matching code.
 *
 * In `json`/`raw` mode the message is a structured `{error, code, hint?}`
 * envelope so agents can parse it; in pretty mode it is a plain line, followed
 * by the hint when an `InvalidArgumentError` carries one.
 *
 * @param params.verb - What the command was doing, e.g. `"fetching evaluators"`.
 */
export async function exitWithError({
  verb,
  error,
  format,
}: {
  verb: string;
  error: unknown;
  format?: OutputFormat;
}): Promise<never> {
  const exitCode = getExitCodeForError(error);
  writeStructuredError({
    format,
    message: `Error ${verb}: ${await describeError(error)}`,
    code: exitCodeName(exitCode),
    hint: error instanceof InvalidArgumentError ? error.hint : undefined,
  });
  process.exit(exitCode);
}

/** Reject a `--limit` that parsed to NaN (zero, negative, fractional, or not a number). */
export function requireValidLimitOrExit({
  limit,
  format,
}: {
  limit: number | undefined;
  format?: OutputFormat;
}): void {
  if (limit !== undefined && Number.isNaN(limit)) {
    writeStructuredError({
      format,
      message: "--limit must be a positive integer",
      code: "INVALID_ARGUMENT",
    });
    process.exit(ExitCode.INVALID_ARGUMENT);
  }
}
