import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { operations } from "../__generated__/api/v1";
import { ProjectSelector } from "../types/projects";

/**
 * Parameters to get spans from a project using auto-generated types
 */
export interface GetSpansParams extends ClientFn {
  /** The project to get spans from */
  project: ProjectSelector;
  /** Inclusive lower bound time. Must be a valid ISO 8601 string or Date object. */
  startTime?: Date | string | null;
  /** Exclusive upper bound time. Must be a valid ISO 8601 string or Date object. */
  endTime?: Date | string | null;
  /** Pagination cursor (Span Global ID) */
  cursor?: string | null;
  /** Maximum number of spans to return */
  limit?: number;
}

export type GetSpansResponse = operations["getSpans"]["responses"]["200"];

export type GetSpansResult = {
  spans: GetSpansResponse["content"]["application/json"]["data"];
  nextCursor: GetSpansResponse["content"]["application/json"]["next_cursor"];
};

/**
 * Get spans from a project with filtering criteria.
 *
 * This method allows you to search for spans within a project using various filters
 * such as time range and supports cursor-based pagination.
 * The spans are returned in Phoenix's standard format with human-readable timestamps
 * and simplified attribute structures.
 *
 * @experimental this function is experimental and may change in the future
 *
 * @param params - The parameters to search for spans
 * @returns A paginated response containing spans and optional next cursor
 *
 * @example
 * ```ts
 * // Get recent spans from a project
 * const result = await getSpans({
 *   client,
 *   project: { projectName: "my-project" },
 *   limit: 50
 * });
 *
 * // Get spans in a time range

 * const result = await getSpans({
 *   client,
 *   project: { projectName: "my-project" },
 *   startTime: new Date("2024-01-01"),
 *   endTime: new Date("2024-01-02"),
 *   limit: 100
 * });

 *
 * // Paginate through results
 * let cursor: string | undefined;
 * do {
 *   const result = await getSpans({
 *     client,
 *     project: { projectName: "my-project" },
 *     cursor,
 *     limit: 100
 *   });
 *
 *   // Process spans
 *   result.spans.forEach(span => {
 *     console.log(`Span: ${span.name}, Trace: ${span.context.trace_id}`);
 *   });
 *
 *   cursor = result.nextCursor || undefined;
 * } while (cursor);
 * ```
 */
export async function getSpans({
  client: _client,
  project,
  cursor,
  limit = 100,
  startTime,
  endTime,
}: GetSpansParams): Promise<GetSpansResult> {
  const client = _client ?? createClient();
  const projectIdentifier =
    "projectId" in project ? project.projectId : project.projectName;

  const params: NonNullable<operations["getSpans"]["parameters"]["query"]> = {
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

  const { data, error } = await client.GET(
    "/v1/projects/{project_identifier}/spans",
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
    spans: data?.data ?? [],
    nextCursor: data?.next_cursor ?? null,
  };
}
