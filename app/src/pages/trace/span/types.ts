import type { DocumentAnnotation } from "../DocumentAnnotationItem";

/**
 * The mime type of a span input / output value as reported by the server.
 */
export type MimeType = "json" | "text";

/**
 * A span input or output value along with the mime type describing how it
 * should be rendered.
 */
export type SpanIOValue = {
  readonly value: string;
  readonly mimeType: MimeType;
};

/**
 * A span attribute object that is a map of string to an unknown value
 */
export type AttributeObject = Record<string, unknown>;

/**
 * The result of safely parsing the span attributes JSON string.
 */
export type SpanAttributesParseResult = {
  json: { [key: string]: unknown } | null;
  parseError?: unknown;
};

/**
 * The prompt-template fields after untrusted span attributes have been
 * normalized for display.
 */
export type SpanPromptTemplate = {
  template?: string;
  variables?: unknown;
};

/**
 * An evaluation (annotation) attached to a retrieved document.
 */
export type DocumentEvaluation = DocumentAnnotation;

/**
 * Document retrieval metrics computed for a retriever span.
 */
export type RetrievalMetric = {
  readonly evaluationName: string;
  readonly ndcg: number | null;
  readonly precision: number | null;
  readonly hit: number | null;
};

/**
 * The minimal shape of span data needed to render the span info view.
 * Structurally compatible with the Span type returned by
 * SpanDetailsContentQuery so the components in this folder stay decoupled
 * from Relay generated types.
 */
export type SpanInfoData = {
  readonly id: string;
  readonly spanKind: string;
  readonly attributes: string;
  readonly input: SpanIOValue | null;
  readonly output: SpanIOValue | null;
  readonly documentRetrievalMetrics: ReadonlyArray<RetrievalMetric>;
  readonly documentEvaluations: ReadonlyArray<DocumentEvaluation>;
};
