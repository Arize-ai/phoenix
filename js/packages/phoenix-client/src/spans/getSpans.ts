import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { SpanSearchParams, SpanSearchResponse } from "./types";

/**
 * Parameters to get spans from a project
 */
interface GetSpansParams extends ClientFn, SpanSearchParams {}

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
 *   projectIdentifier: "my-project",
 *   limit: 50,
 *   sortDirection: "desc"
 * });
 *
 * // Get spans with specific annotations in a time range
 * const result = await getSpans({
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
  sortDirection = "desc",
  startTime,
  endTime,
  annotationNames,
}: GetSpansParams): Promise<SpanSearchResponse> {
  const client = _client ?? createClient();

  // Build query parameters
  const params: Record<string, string | number | string[]> = {
    limit,
    sort_direction: sortDirection,
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
