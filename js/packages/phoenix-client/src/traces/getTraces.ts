import type { operations } from "../__generated__/api/v1";
import { createClient } from "../client";
import {
  GET_TRACES_FILTERS,
  LIST_PROJECT_TRACES,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for getting traces from a project.
 */
export interface GetTracesParams extends ClientFn {
  /** The project to get traces from */
  project: ProjectIdentifier;
  /** Inclusive lower bound time. Must be a valid ISO 8601 string or Date object. */
  startTime?: Date | string | null;
  /** Exclusive upper bound time. Must be a valid ISO 8601 string or Date object. */
  endTime?: Date | string | null;
  /** Sort field */
  sort?: "start_time" | "latency_ms";
  /** Sort direction */
  order?: "asc" | "desc";
  /** Maximum number of traces to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string | null;
  /** If true, include full span details for each trace */
  includeSpans?: boolean;
  /** Filter traces by session identifier(s) (session_id strings or GlobalIDs) */
  sessionId?: string | string[] | null;
  /**
   * Filter by trace error status. `true` returns only traces containing at
   * least one errored span, `false` only traces with no errored spans.
   * Omit to leave traces unfiltered by error status.
   *
   * @requires Phoenix server >= 20.8.0
   */
  error?: boolean | null;
  /**
   * Inclusive lower bound on trace latency in milliseconds.
   *
   * @requires Phoenix server >= 20.8.0
   */
  minLatencyMs?: number | null;
  /**
   * Inclusive upper bound on trace latency in milliseconds.
   *
   * @requires Phoenix server >= 20.8.0
   */
  maxLatencyMs?: number | null;
}

/**
 * Reject latency bounds the server would reject (negatives) or that can never
 * match a trace (an inverted range), so callers get a clear error instead of a
 * 422 or a silently empty page.
 */
function validateLatencyBounds({
  minLatencyMs,
  maxLatencyMs,
}: Pick<GetTracesParams, "minLatencyMs" | "maxLatencyMs">): void {
  if (minLatencyMs != null && minLatencyMs < 0) {
    throw new Error(`minLatencyMs must be non-negative, got ${minLatencyMs}`);
  }
  if (maxLatencyMs != null && maxLatencyMs < 0) {
    throw new Error(`maxLatencyMs must be non-negative, got ${maxLatencyMs}`);
  }
  if (
    minLatencyMs != null &&
    maxLatencyMs != null &&
    minLatencyMs > maxLatencyMs
  ) {
    throw new Error(
      `minLatencyMs (${minLatencyMs}) must not exceed maxLatencyMs (${maxLatencyMs})`
    );
  }
}

type ListProjectTracesQuery = NonNullable<
  operations["listProjectTraces"]["parameters"]["query"]
>;

/**
 * Translate the camelCase parameters into the endpoint's snake_case query,
 * omitting anything the caller left unset so the server applies its defaults.
 */
function buildQuery({
  cursor,
  limit = 100,
  startTime,
  endTime,
  sort,
  order,
  includeSpans,
  sessionId,
  error,
  minLatencyMs,
  maxLatencyMs,
}: Omit<GetTracesParams, "client" | "project">): ListProjectTracesQuery {
  const query: ListProjectTracesQuery = { limit };
  if (cursor) {
    query.cursor = cursor;
  }
  if (startTime) {
    query.start_time =
      startTime instanceof Date ? startTime.toISOString() : startTime;
  }
  if (endTime) {
    query.end_time = endTime instanceof Date ? endTime.toISOString() : endTime;
  }
  if (sort) {
    query.sort = sort;
  }
  if (order) {
    query.order = order;
  }
  if (includeSpans) {
    query.include_spans = true;
  }
  if (sessionId) {
    query.session_identifier = Array.isArray(sessionId)
      ? sessionId
      : [sessionId];
  }
  // `error: false` is a meaningful filter (traces with no errored spans), so
  // send the parameter whenever it was set rather than only when truthy.
  if (error != null) {
    query.error = error;
  }
  if (minLatencyMs != null) {
    query.min_latency_ms = minLatencyMs;
  }
  if (maxLatencyMs != null) {
    query.max_latency_ms = maxLatencyMs;
  }
  return query;
}

export type GetTracesResponse =
  operations["listProjectTraces"]["responses"]["200"];

export type GetTracesResult = {
  traces: GetTracesResponse["content"]["application/json"]["data"];
  nextCursor: GetTracesResponse["content"]["application/json"]["next_cursor"];
};

/**
 * Get traces from a project with filtering and sorting options.
 *
 * This method fetches traces from a project with support for time range filtering,
 * sorting, session filtering, and cursor-based pagination.
 *
 * @requires Phoenix server >= 13.15.0
 *
 * @param params - The parameters to get traces
 * @returns A paginated response containing traces and optional next cursor
 *
 * @example
 * ```ts
 * // Get recent traces from a project
 * const result = await getTraces({
 *   client,
 *   project: { projectName: "my-project" },
 *   limit: 50,
 * });
 *
 * // Get traces in a time range with spans included
 * const result = await getTraces({
 *   client,
 *   project: { projectName: "my-project" },
 *   startTime: new Date("2024-01-01"),
 *   endTime: new Date("2024-01-02"),
 *   includeSpans: true,
 * });
 *
 * // Paginate through results
 * let cursor: string | undefined;
 * do {
 *   const result = await getTraces({
 *     client,
 *     project: { projectName: "my-project" },
 *     cursor,
 *     limit: 100,
 *   });
 *   result.traces.forEach(trace => {
 *     console.log(`Trace: ${trace.trace_id}`);
 *   });
 *   cursor = result.nextCursor || undefined;
 * } while (cursor);
 *
 * // Only slow traces that errored
 * const slowFailures = await getTraces({
 *   client,
 *   project: { projectName: "my-project" },
 *   error: true,
 *   minLatencyMs: 1000,
 * });
 * ```
 */
export async function getTraces({
  client: _client,
  project,
  ...params
}: GetTracesParams): Promise<GetTracesResult> {
  const { error: errorFilter, minLatencyMs, maxLatencyMs } = params;
  const client = _client ?? createClient();
  validateLatencyBounds({ minLatencyMs, maxLatencyMs });
  await ensureServerCapability({ client, requirement: LIST_PROJECT_TRACES });
  if (errorFilter != null || minLatencyMs != null || maxLatencyMs != null) {
    await ensureServerCapability({ client, requirement: GET_TRACES_FILTERS });
  }
  const projectIdentifier = resolveProjectIdentifier(project);
  const query = buildQuery(params);

  const { data, error } = await client.GET(
    "/v1/projects/{project_identifier}/traces",
    {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
        query,
      },
    }
  );

  if (error) throw error;
  return {
    traces: data?.data ?? [],
    nextCursor: data?.next_cursor ?? null,
  };
}
