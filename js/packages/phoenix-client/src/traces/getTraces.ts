import type { operations } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_PROJECT_TRACES } from "../constants/serverRequirements";
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
  /** Pagination cursor (Trace GlobalID) */
  cursor?: string | null;
  /** If true, include full span details for each trace */
  includeSpans?: boolean;
  /** Filter traces by session identifier(s) (session_id strings or GlobalIDs) */
  sessionId?: string | string[] | null;
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
 * ```
 */
export async function getTraces({
  client: _client,
  project,
  cursor,
  limit = 100,
  startTime,
  endTime,
  sort,
  order,
  includeSpans,
  sessionId,
}: GetTracesParams): Promise<GetTracesResult> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: LIST_PROJECT_TRACES });
  const projectIdentifier = resolveProjectIdentifier(project);

  const params: NonNullable<
    operations["listProjectTraces"]["parameters"]["query"]
  > = {
    limit,
  };

  if (cursor) {
    params.cursor = cursor;
  }

  if (startTime) {
    params.start_time =
      startTime instanceof Date ? startTime.toISOString() : startTime;
  }

  if (endTime) {
    params.end_time = endTime instanceof Date ? endTime.toISOString() : endTime;
  }

  if (sort) {
    params.sort = sort;
  }

  if (order) {
    params.order = order;
  }

  if (includeSpans) {
    params.include_spans = true;
  }

  if (sessionId) {
    params.session_identifier = Array.isArray(sessionId)
      ? sessionId
      : [sessionId];
  }

  const { data, error } = await client.GET(
    "/v1/projects/{project_identifier}/traces",
    {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
        query: params,
      },
    }
  );

  if (error) throw error;
  return {
    traces: data?.data ?? [],
    nextCursor: data?.next_cursor ?? null,
  };
}
