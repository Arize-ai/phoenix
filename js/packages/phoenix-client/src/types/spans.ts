import type { OpenInferenceSpanKind } from "@arizeai/phoenix-otel";

/**
 * Status codes for spans.
 */
export type SpanStatusCode = "OK" | "ERROR" | "UNSET";

/**
 * Span kind filter value. Accepts well-known OpenInference span kinds
 * as well as arbitrary strings for forward-compatibility.
 */
export type SpanKindFilter = OpenInferenceSpanKind | (string & {});
