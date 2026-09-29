import {
  formatApiError,
  HttpError,
  type ProblemDetail,
} from "@arizeai/phoenix-client";

import {
  ExitCode,
  exitCodeName,
  getExitCodeForError,
  InvalidArgumentError,
} from "../exitCodes";
import { writeStructuredError } from "../structuredError";
import type { OutputFormat } from "./formatEvaluator";

const MAX_DETAIL_LENGTH = 2000;

/**
 * Describe a failure for the terminal, including the server's explanation.
 *
 * Routes that return problem details explain the failure on `error.problem`;
 * others put it in the body as text or FastAPI's JSON validation detail.
 */
export async function describeError(error: unknown): Promise<string> {
  if (error instanceof HttpError) {
    const detail = error.problem
      ? describeProblem(error)
      : await readDetail(error);
    return `HTTP ${error.status} ${error.statusText}${detail ? `: ${detail}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** The status and problem details of a failed API request, if any. */
export function describeFailure(error: unknown): {
  status?: number;
  problemCode?: string;
  problemReason?: string;
  existingId?: string;
  problem?: ProblemDetail;
} {
  if (!(error instanceof HttpError)) return {};
  return {
    status: error.status,
    problemCode: error.problem?.code,
    problemReason: error.problem?.reason,
    existingId: error.problem?.existing_id,
    problem: error.problem,
  };
}

function describeProblem(error: HttpError): string {
  const problem = error.problem;
  if (!problem) return "";
  const lines = [problem.detail];
  for (const fieldError of problem.errors ?? []) {
    lines.push(`${fieldError.field}: ${fieldError.message}`);
  }
  if (problem.existing_id) lines.push(`existing_id: ${problem.existing_id}`);
  return lines.join("; ");
}

/**
 * A `hint` for the structured error envelope: one line per field error from a
 * `validation_error` response, as `--flag: reason`. `reason` is always the
 * server's own text — the CLI keeps no copy of the server's field rules (e.g.
 * the name pattern) to duplicate here. The flag is the field's normalized
 * path (`body.name`, `query.name`, `path.evaluator_id`) with the location
 * prefix stripped and underscores dashed, which matches this CLI's flag
 * names.
 */
export function validationHint(error: unknown): string | undefined {
  if (!(error instanceof HttpError)) return undefined;
  const problem = error.problem;
  if (problem?.code !== "validation_error" || !problem.errors?.length) {
    return undefined;
  }
  return problem.errors
    .map((fieldError) => {
      const field = fieldError.field.replace(/^(body|query|path)\./, "");
      return `--${field.replace(/_/g, "-")}: ${fieldError.message}`;
    })
    .join("; ");
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
    hint: error instanceof InvalidArgumentError
      ? error.hint
      : validationHint(error),
    ...describeFailure(error),
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
