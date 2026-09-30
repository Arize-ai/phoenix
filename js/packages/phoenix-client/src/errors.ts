/**
 * RFC 9457 problem details, returned by the routes that report structured errors.
 *
 * `code` is stable and machine-readable (for example `already_exists` or
 * `validation_error`); treat an unrecognized code by its status. `existing_id`
 * names the resource that holds a taken name, and `errors` lists every invalid
 * input of a request that failed schema validation.
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: { field: string; code: string; message: string }[];
  existing_id?: string;
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
  if (problem.existing_id) lines.push(`  existing_id: ${problem.existing_id}`);
  return lines.join("\n");
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
    return body && typeof body === "object"
      ? (body as ProblemDetail)
      : undefined;
  } catch {
    return undefined;
  }
}
