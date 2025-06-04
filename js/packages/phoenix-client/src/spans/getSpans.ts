import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { components, operations } from "../__generated__/api/v1";

/**
 * Parameters to get spans from a project using auto-generated types
 */
interface GetSpansParams
  extends ClientFn,
    Omit<
      NonNullable<operations["spanSearch"]["parameters"]["query"]>,
      "start_time" | "end_time"
    > {
  /** The project identifier: either project ID or project name (maps to path parameter) */
  projectIdentifier: operations["spanSearch"]["parameters"]["path"]["project_identifier"];
  /** Inclusive lower bound time (convenience field with camelCase naming) */
  startTime?: Date | string | null;
  /** Exclusive upper bound time (convenience field with camelCase naming) */
  endTime?: Date | string | null;
}

/**
 * Response type for span search using auto-generated types
 */
type SpanSearchResponse = components["schemas"]["OtlpSpansResponseBody"];

/**
 * Get spans from a project with filtering criteria.
 *
 * This method allows you to search for spans within a project using various filters
 * such as time range and supports cursor-based pagination.
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
 *   limit: 50
 * });
 *
 * // Get spans in a time range
 * const result = await getSpans({
 *   client,
 *   projectIdentifier: "my-project",
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
  startTime,
  endTime,
}: GetSpansParams): Promise<SpanSearchResponse> {
  const client = _client ?? createClient();

  // Build query parameters using auto-generated types
  const params: NonNullable<operations["spanSearch"]["parameters"]["query"]> = {
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
