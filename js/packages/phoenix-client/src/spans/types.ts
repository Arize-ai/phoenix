import { paths } from "../__generated__/api/v1";

type SpanAnnotationData =
  paths["/v1/span_annotations"]["post"]["requestBody"]["content"]["application/json"]["data"][0];

/**
 * Parameters for a single span annotation
 */
export interface SpanAnnotation {
  /**
   * The OpenTelemetry Span ID (hex format without 0x prefix)
   */
  spanId: string;
  /**
   * The name of the annotation
   */
  name: string;
  /**
   * The label assigned by the annotation
   */
  label?: string;
  /**
   * The score assigned by the annotation
   */
  score?: number;
  /**
   * The identifier of the annotation. If provided, the annotation will be updated if it already exists.
   */
  identifier?: string;
  /**
   * Metadata for the annotation
   */
  metadata?: Record<string, unknown>;
  /**
   * The kind of annotator used for the annotation
   * Can be "HUMAN", "LLM", or "CODE"
   * @default "HUMAN"
   */
  annotatorKind?: SpanAnnotationData["annotator_kind"];
}

/**
 * Convert a SpanAnnotation to the API format
 */
export function toSpanAnnotationData(
  annotation: SpanAnnotation
): SpanAnnotationData {
  return {
    span_id: annotation.spanId,
    name: annotation.name,
    annotator_kind: annotation.annotatorKind ?? "HUMAN",
    result: {
      label: annotation.label ?? null,
      score: annotation.score ?? null,
      explanation: null,
    },
    metadata: annotation.metadata ?? null,
    identifier: annotation.identifier ?? "",
  };
}

// OTLP Span types based on the Python models

/**
 * OTLP AnyValue type for span attributes
 */
export interface OtlpAnyValue {
  array_value?: OtlpArrayValue;
  bool_value?: boolean;
  bytes_value?: string;
  double_value?: number | string;
  int_value?: number | string;
  string_value?: string;
}

/**
 * OTLP ArrayValue type
 */
export interface OtlpArrayValue {
  values?: OtlpAnyValue[];
}

/**
 * OTLP KeyValue pair for span attributes
 */
export interface OtlpKeyValue {
  key?: string;
  value?: OtlpAnyValue;
}

/**
 * OTLP Status for spans
 */
export interface OtlpStatus {
  code?: number;
  message?: string;
}

/**
 * OTLP Event for spans
 */
export interface OtlpEvent {
  attributes?: OtlpKeyValue[];
  dropped_attributes_count?: number;
  name?: string;
  time_unix_nano?: number | string;
}

/**
 * OTLP Span following OpenTelemetry specification
 */
export interface OtlpSpan {
  attributes?: OtlpKeyValue[];
  dropped_attributes_count?: number;
  dropped_events_count?: number;
  dropped_links_count?: number;
  end_time_unix_nano?: number | string;
  events?: OtlpEvent[];
  flags?: number;
  kind?: string | number;
  name?: string;
  parent_span_id?: string;
  span_id?: string;
  start_time_unix_nano?: number | string;
  status?: OtlpStatus;
  trace_id?: string;
  trace_state?: string;
}

/**
 * Parameters for searching spans
 */
export interface SpanSearchParams {
  /**
   * The project identifier: either project ID or project name
   */
  projectIdentifier: string;
  /**
   * Pagination cursor (GlobalID of Span)
   */
  cursor?: string;
  /**
   * Maximum number of spans to return (1-1000)
   * @default 100
   */
  limit?: number;
  /**
   * Sort direction for the sort field
   * @default "desc"
   */
  sortDirection?: "asc" | "desc";
  /**
   * Inclusive lower bound time
   */
  startTime?: Date | string;
  /**
   * Exclusive upper bound time
   */
  endTime?: Date | string;
  /**
   * If provided, only include spans that have at least one annotation with one of these names
   */
  annotationNames?: string[];
}

/**
 * Response body for span search
 */
export interface SpanSearchResponse {
  /**
   * Next cursor for pagination
   */
  next_cursor?: string | null;
  /**
   * Array of OTLP spans
   */
  data: OtlpSpan[];
}
