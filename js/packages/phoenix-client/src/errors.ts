/**
 * RFC 9457 problem details, returned by the routes that report structured errors.
 *
 * `code` is stable and machine-readable (for example `already_exists` or
 * `validation_error`); treat an unrecognized code by its status. `reason` is a finer
 * condition under `code` (for example `still_bound`); treat an unrecognized reason by
 * `code`. `errors` lists every invalid input of a request that failed schema validation.
 * The remaining fields are the recovery data a caller needs for a given `reason`:
 * `existing_id` (`already_exists`) names the resource that holds a taken name,
 * `current_version_id` (`version_mismatch`) is the version actually current — null when
 * there is none yet — `binding_counts` (`still_bound`) counts what still refuses a delete,
 * and `dataset_evaluator_ids` (`incompatible_override`) names the bindings whose overrides
 * no longer fit. The index signature lets a future member (an unreleased reason's own
 * field, say) pass through unread rather than being stripped.
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  reason?: string;
  errors?: { field: string; code: string; message: string }[];
  existing_id?: string;
  current_version_id?: string | null;
  binding_counts?: { project: number; dataset: number };
  dataset_evaluator_ids?: string[];
  [extension: string]: unknown;
}

/**
 * Thrown when Phoenix answers a request with a non-2xx status.
 *
 * `status` is on the error so callers can branch on it: a status is frequently
 * a legitimate answer rather than a bug — a 401 from an unauthenticated probe,
 * for instance, is how a caller learns that auth is enabled on the deployment.
 * When the server explains the failure with problem details, they are on
 * `problem` and summarized in the message.
 */
export class HttpError extends Error {
  readonly response: Response;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly problem?: ProblemDetail;

  constructor(response: Response, problem?: ProblemDetail) {
    super(describe(response, problem));
    this.name = "HttpError";
    this.response = response;
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
    this.problem = problem;
  }
}

function describe(response: Response, problem?: ProblemDetail): string {
  const base = `${response.url}: ${response.status} ${response.statusText}`;
  if (!problem) return base;
  const lines = [`${base}: [${problem.code}] ${problem.detail}`];
  for (const error of problem.errors ?? []) {
    lines.push(`  ${error.field}: ${error.message}`);
  }
  if (problem.reason) lines.push(`  reason: ${problem.reason}`);
  if (problem.existing_id) lines.push(`  existing_id: ${problem.existing_id}`);
  return lines.join("\n");
}

/**
 * A problem body is an object with, at minimum, a numeric `status` and string `code` and
 * `detail`; anything else (a proxy's HTML page, a truncated body, a body some other layer
 * wrote under this content type) is not one, even under the right content type.
 */
function isProblemDetail(body: unknown): body is ProblemDetail {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.status === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.detail === "string"
  );
}

/**
 * Read a response's problem details, leaving the body unread for other readers.
 */
export async function readProblemDetail(
  response: Response
): Promise<ProblemDetail | undefined> {
  if (
    !response.headers
      .get("content-type")
      ?.startsWith("application/problem+json")
  ) {
    return undefined;
  }
  try {
    const body: unknown = await response.clone().json();
    return isProblemDetail(body) ? body : undefined;
  } catch {
    return undefined;
  }
}
