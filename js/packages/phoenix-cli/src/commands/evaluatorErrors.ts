import { formatApiError, HttpError } from "@arizeai/phoenix-client";

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

/** The status, reason, and existing resource of a failed API request, if any. */
export function describeFailure(error: unknown): {
  status?: number;
  reason?: string;
  existingId?: string;
} {
  if (!(error instanceof HttpError)) return {};
  return {
    status: error.status,
    reason: error.problem?.code,
    existingId: error.problem?.existing_id,
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
