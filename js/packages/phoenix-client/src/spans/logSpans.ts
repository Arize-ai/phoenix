import type { paths } from "../__generated__/api/v1";
import { createClient } from "../client";
import { HttpError } from "../errors";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { formatApiError } from "../utils/apiErrorUtils";
import { isObject } from "../utils/isObject";
import { safelyParseJSON } from "../utils/safelyParseJSON";

type CreateSpansRequestData =
  paths["/v1/projects/{project_identifier}/spans"]["post"]["requestBody"]["content"]["application/json"]["data"];

/**
 * A span in Phoenix's simplified span structure, as accepted by {@link logSpans}.
 * This is the same shape returned by `getSpans`, which makes it possible to read
 * spans from one project and log them into another.
 */
export type Span = CreateSpansRequestData[number];

/** Information about a span that failed validation and was not queued. */
export interface InvalidSpanInfo {
  spanId: string;
  traceId: string;
  error: string;
}

/** Information about a span that was rejected because it already exists. */
export interface DuplicateSpanInfo {
  spanId: string;
  traceId: string;
}

/**
 * Raised by {@link logSpans} when one or more spans in the request are invalid
 * or duplicates. If any span in a request fails, none of the spans in that
 * request are queued.
 */
export class SpanCreationError extends Error {
  readonly invalidSpans: InvalidSpanInfo[];
  readonly duplicateSpans: DuplicateSpanInfo[];
  readonly totalReceived: number;
  readonly totalQueued: number;

  constructor(params: {
    message: string;
    invalidSpans?: InvalidSpanInfo[];
    duplicateSpans?: DuplicateSpanInfo[];
    totalReceived?: number;
    totalQueued?: number;
  }) {
    super(params.message);
    this.name = "SpanCreationError";
    this.invalidSpans = params.invalidSpans ?? [];
    this.duplicateSpans = params.duplicateSpans ?? [];
    this.totalReceived = params.totalReceived ?? 0;
    this.totalQueued = params.totalQueued ?? 0;
  }

  /** Number of spans rejected as invalid. */
  get totalInvalid(): number {
    return this.invalidSpans.length;
  }

  /** Number of spans rejected as duplicates. */
  get totalDuplicates(): number {
    return this.duplicateSpans.length;
  }
}

/**
 * Parameters to log spans to a project
 */
export interface LogSpansParams extends ClientFn {
  /** The project to log spans into */
  project: ProjectIdentifier;
  /** The spans to log */
  spans: Span[];
}

/**
 * Statistics about a {@link logSpans} call. When successful, `totalQueued`
 * equals `totalReceived`.
 */
export interface LogSpansResult {
  totalReceived: number;
  totalQueued: number;
}

const MAX_ERRORS_TO_SHOW = 5;

function formatLogSpansErrorMessage({
  invalidSpans,
  duplicateSpans,
}: {
  invalidSpans: InvalidSpanInfo[];
  duplicateSpans: DuplicateSpanInfo[];
}): string {
  const parts: string[] = [];

  if (invalidSpans.length > 0) {
    parts.push(`Failed to queue ${invalidSpans.length} invalid spans:`);
    for (const span of invalidSpans.slice(0, MAX_ERRORS_TO_SHOW)) {
      parts.push(`  - Span ${span.spanId}: ${span.error}`);
    }
    if (invalidSpans.length > MAX_ERRORS_TO_SHOW) {
      parts.push(
        `  ... and ${invalidSpans.length - MAX_ERRORS_TO_SHOW} more invalid spans`
      );
    }
  }

  if (duplicateSpans.length > 0) {
    if (parts.length > 0) parts.push("");
    parts.push(`Found ${duplicateSpans.length} duplicate spans:`);
    for (const span of duplicateSpans.slice(0, MAX_ERRORS_TO_SHOW)) {
      parts.push(`  - Span ${span.spanId}`);
    }
    if (duplicateSpans.length > MAX_ERRORS_TO_SHOW) {
      parts.push(
        `  ... and ${duplicateSpans.length - MAX_ERRORS_TO_SHOW} more duplicates`
      );
    }
  }

  return parts.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

function toSpanIdAndTraceId(item: unknown): {
  spanId: string;
  traceId: string;
} {
  const record: Record<string, unknown> = isRecord(item) ? item : {};
  return {
    spanId: typeof record.span_id === "string" ? record.span_id : "unknown",
    traceId: typeof record.trace_id === "string" ? record.trace_id : "unknown",
  };
}

function toInvalidSpanInfoList(value: unknown): InvalidSpanInfo[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record: Record<string, unknown> = isRecord(item) ? item : {};
    return {
      ...toSpanIdAndTraceId(item),
      error:
        typeof record.error === "string" ? record.error : "Validation error",
    };
  });
}

function toDuplicateSpanInfoList(value: unknown): DuplicateSpanInfo[] {
  if (!Array.isArray(value)) return [];
  return value.map(toSpanIdAndTraceId);
}

/**
 * Builds a {@link SpanCreationError} from already-normalized invalid/duplicate
 * span lists, computing the shared message once.
 */
function makeSpanCreationError(params: {
  invalidSpans: InvalidSpanInfo[];
  duplicateSpans: DuplicateSpanInfo[];
  totalReceived: number;
  totalQueued: number;
}): SpanCreationError {
  return new SpanCreationError({
    message: formatLogSpansErrorMessage(params),
    ...params,
  });
}

/**
 * Builds a {@link SpanCreationError} from a parsed error payload matching the
 * shape returned by the server for invalid/duplicate spans:
 * `{ total_received, total_queued, total_invalid, total_duplicates, invalid_spans, duplicate_spans }`.
 */
function buildSpanCreationError(
  payload: Record<string, unknown>
): SpanCreationError {
  return makeSpanCreationError({
    invalidSpans: toInvalidSpanInfoList(payload.invalid_spans),
    duplicateSpans: toDuplicateSpanInfoList(payload.duplicate_spans),
    totalReceived:
      typeof payload.total_received === "number" ? payload.total_received : 0,
    totalQueued:
      typeof payload.total_queued === "number" ? payload.total_queued : 0,
  });
}

function isSpanCreationErrorPayload(
  value: unknown
): value is Record<string, unknown> {
  return (
    isObject(value) && ("invalid_spans" in value || "duplicate_spans" in value)
  );
}

/**
 * Extracts invalid span info from a FastAPI request-validation error array
 * (returned with a 422 status when a span in the payload is malformed).
 */
function extractInvalidSpansFromValidationErrors(
  errors: unknown[],
  spans: Span[]
): InvalidSpanInfo[] {
  const invalidSpans: InvalidSpanInfo[] = [];

  for (const rawError of errors) {
    if (!isObject(rawError)) continue;
    const loc = (rawError as { loc?: unknown }).loc;
    if (
      !Array.isArray(loc) ||
      loc.length < 3 ||
      loc[0] !== "body" ||
      loc[1] !== "data" ||
      typeof loc[2] !== "number"
    ) {
      continue;
    }

    const span = spans[loc[2]];
    if (!span) continue;

    const msg = (rawError as { msg?: unknown }).msg;
    invalidSpans.push({
      spanId: span.context?.span_id ?? "unknown",
      traceId: span.context?.trace_id ?? "unknown",
      error: typeof msg === "string" ? msg : "Validation error",
    });
  }

  return invalidSpans;
}

function parseLogSpansError(error: unknown, spans: Span[]): Error {
  if (isObject(error)) {
    const detail = (error as { detail?: unknown }).detail;

    if (typeof detail === "string") {
      const { json: parsed } = safelyParseJSON(detail);
      if (isSpanCreationErrorPayload(parsed)) {
        return buildSpanCreationError(parsed);
      }
    } else if (Array.isArray(detail)) {
      const invalidSpans = extractInvalidSpansFromValidationErrors(
        detail,
        spans
      );
      if (invalidSpans.length > 0) {
        return makeSpanCreationError({
          invalidSpans,
          duplicateSpans: [],
          totalReceived: spans.length,
          // A FastAPI 422 rejects the entire request body, so no spans are
          // queued — matching the all-or-nothing contract and the 400 path.
          totalQueued: 0,
        });
      }
    } else if (isSpanCreationErrorPayload(error)) {
      return buildSpanCreationError(error);
    }
  }

  return new Error(`Failed to log spans: ${formatApiError(error)}`);
}

async function parseLogSpansHttpError(
  error: HttpError,
  spans: Span[]
): Promise<Error> {
  try {
    const contentType = error.response.headers.get("content-type");
    const payload: unknown = contentType?.includes("application/json")
      ? await error.response.json()
      : await error.response.text();
    return parseLogSpansError(payload, spans);
  } catch {
    return parseLogSpansError(error, spans);
  }
}

/**
 * Log spans to a project using Phoenix's simplified span structure.
 *
 * If any span in the request is invalid or a duplicate of a span that already
 * exists, none of the spans in the request are queued and a
 * {@link SpanCreationError} is thrown with details about the failures.
 *
 * @experimental this function is experimental and may change in the future
 *
 * @param params - The parameters to log spans
 * @returns Statistics about the operation. When successful, `totalQueued`
 * equals `totalReceived`.
 *
 * @example
 * ```ts
 * const result = await logSpans({
 *   project: { projectName: "my-project" },
 *   spans: [
 *     {
 *       name: "test",
 *       context: { trace_id: "123", span_id: "456" },
 *       span_kind: "CHAIN",
 *       start_time: "2024-01-01T00:00:00Z",
 *       end_time: "2024-01-01T00:00:01Z",
 *       status_code: "OK",
 *     },
 *   ],
 * });
 * console.log(`Queued ${result.totalQueued} spans`);
 * ```
 */
export async function logSpans({
  client: _client,
  project,
  spans,
}: LogSpansParams): Promise<LogSpansResult> {
  const client = _client ?? createClient();
  const projectIdentifier = resolveProjectIdentifier(project);

  let response: Awaited<ReturnType<typeof client.POST>>;
  try {
    response = await client.POST("/v1/projects/{project_identifier}/spans", {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
      },
      body: {
        data: spans,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      throw await parseLogSpansHttpError(error, spans);
    }
    throw error;
  }

  const { data, error } = response;

  if (error) {
    throw parseLogSpansError(error, spans);
  }

  return {
    totalReceived: data?.total_received ?? spans.length,
    totalQueued: data?.total_queued ?? 0,
  };
}
