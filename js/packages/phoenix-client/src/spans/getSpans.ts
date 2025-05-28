import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { components, operations } from "../__generated__/api/v1";

/**
 * Parameters to get spans from a project using auto-generated types
 */
interface GetSpansParams extends ClientFn, Omit<NonNullable<operations["spanSearch"]["parameters"]["query"]>, "start_time" | "end_time"> {
  /** The project identifier: either project ID or project name (maps to path parameter) */
  projectIdentifier: operations["spanSearch"]["parameters"]["path"]["project_identifier"];
  /** Inclusive lower bound time (convenience override to support Date objects) */
  start_time?: Date | string | null;
  /** Exclusive upper bound time (convenience override to support Date objects) */
  end_time?: Date | string | null;
}

/**
 * Response type for span search using auto-generated types
 */
type SpanSearchResponse = components["schemas"]["SpanSearchResponseBody"];

/**
 * Get spans from a project with filtering criteria.
 *
 * This method allows you to search for spans within a project using various filters
 * such as time range, annotation names, and supports cursor-based pagination.
 * The spans are returned in OTLP (OpenTelemetry Protocol) format.
 *
 * @param params - The parameters to search for spans
 * @returns A paginated response containing OTLP spans and optional next cursor
 *
 * @example
 * ```ts
 * // Get recent spans from a project
 * const result = await getSpans({
 *   client,
 *   projectIdentifier: "my-project",
 *   limit: 50,
 *   sort_direction: "desc"
 * });
 *
 * // Get spans with specific annotations in a time range
 * const result = await getSpans({
 *   client,
 *   projectIdentifier: "my-project",
 *   startTime: new Date("2024-01-01"),
 *   endTime: new Date("2024-01-02"),
 *   annotationNames: ["quality_score", "relevance"],
 *   limit: 100
 * });
 *
 * // Paginate through results
 * let cursor: string | undefined;
 * do {
 *   const result = await getSpans({
 *     client,
 *     projectIdentifier: "my-project",
 *     cursor,
 *     limit: 100
 *   });
 *
 *   // Process spans
 *   result.data.forEach(span => {
 *     console.log(`Span: ${span.name}, Trace: ${span.trace_id}`);
 *   });
 *
 *   cursor = result.next_cursor || undefined;
 * } while (cursor);
 * ```
 */
export async function getSpans({
  client: _client,
  projectIdentifier,
  cursor,
  limit = 100,
  sort_direction = "desc",
  start_time,
  end_time,
  annotationNames,
}: GetSpansParams): Promise<SpanSearchResponse> {
  const client = _client ?? createClient();

  // Build query parameters using auto-generated types
  const params: NonNullable<operations["spanSearch"]["parameters"]["query"]> = {
    limit,
    sort_direction,
  };

  if (cursor) {
    params.cursor = cursor;
  }

  if (start_time) {
    params.start_time = start_time instanceof Date ? start_time.toISOString() : start_time;
  }

  if (end_time) {
    params.end_time = end_time instanceof Date ? end_time.toISOString() : end_time;
  }

  if (annotationNames && annotationNames.length > 0) {
    params.annotationNames = annotationNames;
  }

  const { data, error } = await client.GET(
    "/v1/projects/{project_identifier}/spans/otlpv1",
    {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
        query: params,
      },
    }
  );

  if (error) {
    throw new Error(`Failed to get spans: ${JSON.stringify(error)}`);
  }

  if (!data) {
    throw new Error("No data returned from server");
  }

  return data as SpanSearchResponse;
}
