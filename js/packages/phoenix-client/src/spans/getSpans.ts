import type { operations } from "../__generated__/api/v1";
import { createClient } from "../client";
import {
  GET_SPANS_BY_ATTRIBUTE,
  GET_SPANS_FILTERS,
  GET_SPANS_TRACE_IDS,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import type { SpanKindFilter, SpanStatusCode } from "../types/spans";
import { ensureServerCapability } from "../utils/serverVersionUtils";

export type SpanAttributeValue = string | number | boolean;
export type SpanAttributes = Record<string, SpanAttributeValue>;

function serializeAttributeValue(value: SpanAttributeValue): string {
  if (typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(
        `Non-finite attribute filter values are not supported: ${value}`
      );
    }
    return String(value);
  }
  if (value === "") {
    return JSON.stringify(value);
  }
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? value : JSON.stringify(value);
  } catch {
    return value;
  }
}

function serializeAttributes(attributes: SpanAttributes): string[] {
  return Object.entries(attributes).map(
    ([key, value]) => `${key}:${serializeAttributeValue(value)}`
  );
}

/**
 * Parameters to get spans from a project using auto-generated types
 */
export interface GetSpansParams extends ClientFn {
  /** The project to get spans from */
  project: ProjectIdentifier;
  /** Inclusive lower bound time. Must be a valid ISO 8601 string or Date object. */
  startTime?: Date | string | null;
  /** Exclusive upper bound time. Must be a valid ISO 8601 string or Date object. */
  endTime?: Date | string | null;
  /** Pagination cursor (Span Global ID) */
  cursor?: string | null;
  /** Maximum number of spans to return */
  limit?: number;
  /** Filter spans by one or more trace IDs */
  traceIds?: string[] | null;
  /** Filter by parent span ID. Use `null` or the string `"null"` to get root spans only. */
  parentId?: string | null;
  /** Filter by span name(s) */
  name?: string | string[] | null;
  /** Filter by span kind(s) (LLM, CHAIN, TOOL, RETRIEVER, etc.) */
  spanKind?: SpanKindFilter | SpanKindFilter[] | null;
  /** Filter by status code(s) (OK, ERROR, UNSET) */
  statusCode?: SpanStatusCode | SpanStatusCode[] | null;
  /**
   * Filter by attribute key/value pairs with AND semantics. The value's JS type
   * selects how the stored attribute is matched: `{ "user.id": 12345 }` matches
   * a stored integer, while `{ "user.id": "12345" }` matches a stored string.
   */
  attributes?: SpanAttributes | null;
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
 * @requires Phoenix server >= 13.9.0 when filtering by `traceIds`
 * @requires Phoenix server >= 14.9.0 when filtering by `attributes`
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
 * // Get all spans for specific traces (requires Phoenix server >= 13.9.0)
 * const result = await getSpans({
 *   client,
 *   project: { projectName: "my-project" },
 *   traceIds: ["trace-abc-123", "trace-def-456"],
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
  traceIds,
  parentId,
  name,
  spanKind,
  statusCode,
  attributes,
}: GetSpansParams): Promise<GetSpansResult> {
  const client = _client ?? createClient();
  const serializedAttributes =
    attributes != null ? serializeAttributes(attributes) : undefined;
  const attributeFilters =
    serializedAttributes != null && serializedAttributes.length > 0
      ? serializedAttributes
      : undefined;
  if (traceIds) {
    await ensureServerCapability({ client, requirement: GET_SPANS_TRACE_IDS });
  }
  if (name != null || spanKind != null || statusCode != null) {
    await ensureServerCapability({ client, requirement: GET_SPANS_FILTERS });
  }
  if (attributeFilters != null) {
    await ensureServerCapability({
      client,
      requirement: GET_SPANS_BY_ATTRIBUTE,
    });
  }
  const projectIdentifier = resolveProjectIdentifier(project);

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

  if (traceIds) {
    params.trace_id = traceIds;
  }

  if (parentId !== undefined) {
    params.parent_id = parentId === null ? "null" : parentId;
  }

  if (name) {
    params.name = Array.isArray(name) ? name : [name];
  }

  if (spanKind) {
    params.span_kind = Array.isArray(spanKind) ? spanKind : [spanKind];
  }

  if (statusCode) {
    params.status_code = Array.isArray(statusCode) ? statusCode : [statusCode];
  }

  if (attributeFilters != null) {
    params.attribute = attributeFilters;
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
