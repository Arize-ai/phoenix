import {
  ANNOTATIONS,
  ANNOTATION_ANNOTATOR_KIND,
  ANNOTATION_EXPLANATION,
  ANNOTATION_IDENTIFIER,
  ANNOTATION_LABEL,
  ANNOTATION_METADATA,
  ANNOTATION_NAME,
  ANNOTATION_SCORE,
  TRACE_ANNOTATIONS,
} from "@arizeai/openinference-semantic-conventions";
import chunk from "lodash/chunk";

import type { components } from "@phoenix/api/__generated__/v1";
import { authApiFetch } from "@phoenix/api/authApiFetch";

type OtlpSpan = components["schemas"]["OtlpSpan"];
type OtlpKeyValue = components["schemas"]["OtlpKeyValue"];
type PhoenixSpan = components["schemas"]["Span"];
type SpanAnnotation = components["schemas"]["SpanAnnotation"];
type TraceAnnotation = components["schemas"]["TraceAnnotation"];

const PAGE_SIZE = 1000;

// Cap IDs per request so the GET query string stays under common
// server/proxy URL-length limits and the SQL IN() clause stays under database
// bound-parameter limits.
const ID_BATCH_SIZE = 100;

// Defer object-URL revocation so the browser has time to start reading a
// large blob before the URL is invalidated (matches the FileSaver pattern).
const URL_REVOKE_DELAY_MS = 40_000;

export type SpanDownloadScope = "spans" | "traces";
export type SpanDownloadFormat = "jsonl" | "otlp-json";
export type SingleSpanDownloadFormat = "json" | "otlp-json";

export const SPAN_DOWNLOAD_FILE_EXTENSIONS: Record<SpanDownloadFormat, string> =
  {
    jsonl: ".jsonl",
    "otlp-json": ".json",
  };

type SpanSearchQuery = {
  limit: number;
  span_id?: string[];
  trace_id?: string[];
  cursor?: string;
};

type SpanPage<Span> = { data: Span[]; next_cursor?: string | null };

type Annotation = SpanAnnotation | TraceAnnotation;
type AnnotationAttributeValue = string | number;
type AnnotationAttributes = Record<string, AnnotationAttributeValue>;

type AnnotationSearchQuery = {
  limit: number;
  cursor?: string;
};

type AnnotationLookup = {
  spanAnnotationsBySpanId: Map<string, SpanAnnotation[]>;
  traceAnnotationsByTraceId: Map<string, TraceAnnotation[]>;
};

/** Makes a name safe to use in a file name. */
export function sanitizeSpanDownloadFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

/** Returns a filesystem-friendly timestamp for generated download names. */
export function getSpanDownloadTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/:/g, "-");
}

/**
 * Turns an openapi-fetch error into an Error that preserves the HTTP status
 * and any server-provided detail.
 */
function toDownloadError({
  status,
  error,
}: {
  status: number;
  error: unknown;
}): Error {
  const detail =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "detail" in error
        ? String((error as { detail: unknown }).detail)
        : "";
  return new Error(detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`);
}

/**
 * Fetches every span matching the given span or trace IDs and hands each page
 * to the caller as it arrives.
 */
async function fetchSpans<Span>({
  spanIds,
  traceIds,
  fetchPage,
  onPage,
}: {
  spanIds?: string[];
  traceIds?: string[];
  fetchPage: (query: SpanSearchQuery) => Promise<SpanPage<Span>>;
  onPage: (spans: Span[]) => void | Promise<void>;
}): Promise<void> {
  const useSpanIds = spanIds != null;
  const idList = spanIds ?? traceIds ?? [];
  for (const batch of chunk(idList, ID_BATCH_SIZE)) {
    let cursor: string | null = null;
    do {
      const page = await fetchPage({
        limit: PAGE_SIZE,
        ...(useSpanIds ? { span_id: batch } : { trace_id: batch }),
        ...(cursor ? { cursor } : {}),
      });
      await onPage(page.data);
      cursor = page.next_cursor ?? null;
    } while (cursor);
  }
}

/** Fetches annotations in bounded ID batches and follows every cursor. */
async function fetchAnnotations<Annotation>({
  ids,
  fetchPage,
}: {
  ids: string[];
  fetchPage: (params: {
    ids: string[];
    query: AnnotationSearchQuery;
  }) => Promise<SpanPage<Annotation>>;
}): Promise<Annotation[]> {
  const annotations: Annotation[] = [];
  for (const batch of chunk(ids, ID_BATCH_SIZE)) {
    let cursor: string | null = null;
    do {
      const page = await fetchPage({
        ids: batch,
        query: {
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        },
      });
      annotations.push(...page.data);
      cursor = page.next_cursor ?? null;
    } while (cursor);
  }
  return annotations;
}

async function fetchOtlpSpanPage({
  projectId,
  query,
}: {
  projectId: string;
  query: SpanSearchQuery;
}): Promise<SpanPage<OtlpSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans/otlpv1",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError({ status: response.status, error });
  }
  return data;
}

async function fetchSpanPage({
  projectId,
  query,
}: {
  projectId: string;
  query: SpanSearchQuery;
}): Promise<SpanPage<PhoenixSpan>> {
  const { data, error, response } = await authApiFetch.GET(
    "/v1/projects/{project_identifier}/spans",
    { params: { path: { project_identifier: projectId }, query } }
  );
  if (data == null) {
    throw toDownloadError({ status: response.status, error });
  }
  return data;
}

async function fetchSpanAnnotations({
  projectId,
  spanIds,
}: {
  projectId: string;
  spanIds: string[];
}): Promise<SpanAnnotation[]> {
  return fetchAnnotations({
    ids: spanIds,
    fetchPage: async ({ ids, query }) => {
      const { data, error, response } = await authApiFetch.GET(
        "/v1/projects/{project_identifier}/span_annotations",
        {
          params: {
            path: { project_identifier: projectId },
            query: { span_ids: ids, ...query },
          },
        }
      );
      if (data == null) {
        throw toDownloadError({ status: response.status, error });
      }
      return data;
    },
  });
}

async function fetchTraceAnnotations({
  projectId,
  traceIds,
}: {
  projectId: string;
  traceIds: string[];
}): Promise<TraceAnnotation[]> {
  return fetchAnnotations({
    ids: traceIds,
    fetchPage: async ({ ids, query }) => {
      const { data, error, response } = await authApiFetch.GET(
        "/v1/projects/{project_identifier}/trace_annotations",
        {
          params: {
            path: { project_identifier: projectId },
            query: { trace_ids: ids, ...query },
          },
        }
      );
      if (data == null) {
        throw toDownloadError({ status: response.status, error });
      }
      return data;
    },
  });
}

function getAnnotationAttributes({
  annotations,
  prefix,
}: {
  annotations: Annotation[];
  prefix: typeof ANNOTATIONS | typeof TRACE_ANNOTATIONS;
}): AnnotationAttributes {
  const attributes: AnnotationAttributes = {};
  annotations.forEach((annotation, index) => {
    const annotationPrefix = `${prefix}.${index}`;
    attributes[`${annotationPrefix}.${ANNOTATION_NAME}`] = annotation.name;
    attributes[`${annotationPrefix}.${ANNOTATION_ANNOTATOR_KIND}`] =
      annotation.annotator_kind;

    if (annotation.result?.score != null) {
      attributes[`${annotationPrefix}.${ANNOTATION_SCORE}`] =
        annotation.result.score;
    }
    if (annotation.result?.label != null) {
      attributes[`${annotationPrefix}.${ANNOTATION_LABEL}`] =
        annotation.result.label;
    }
    if (annotation.result?.explanation != null) {
      attributes[`${annotationPrefix}.${ANNOTATION_EXPLANATION}`] =
        annotation.result.explanation;
    }
    if (annotation.identifier) {
      attributes[`${annotationPrefix}.${ANNOTATION_IDENTIFIER}`] =
        annotation.identifier;
    }
    if (annotation.metadata && Object.keys(annotation.metadata).length > 0) {
      attributes[`${annotationPrefix}.${ANNOTATION_METADATA}`] = JSON.stringify(
        annotation.metadata
      );
    }
  });
  return attributes;
}

function groupAnnotationsByTargetId<Annotation>({
  annotations,
  getTargetId,
}: {
  annotations: Annotation[];
  getTargetId: (annotation: Annotation) => string;
}): Map<string, Annotation[]> {
  const annotationsByTargetId = new Map<string, Annotation[]>();
  annotations.forEach((annotation) => {
    const targetId = getTargetId(annotation);
    const targetAnnotations = annotationsByTargetId.get(targetId) ?? [];
    targetAnnotations.push(annotation);
    annotationsByTargetId.set(targetId, targetAnnotations);
  });
  return annotationsByTargetId;
}

function getTraceAnnotationCarrierSpanIds<Span>({
  spans,
  getSpanId,
  getTraceId,
  isRootSpan,
}: {
  spans: Span[];
  getSpanId: (span: Span) => string | null | undefined;
  getTraceId: (span: Span) => string | null | undefined;
  isRootSpan: (span: Span) => boolean;
}): Map<string, string> {
  const carrierSpanIdsByTraceId = new Map<string, string>();
  spans.forEach((span) => {
    const spanId = getSpanId(span);
    const traceId = getTraceId(span);
    if (spanId == null || traceId == null) {
      return;
    }
    if (!carrierSpanIdsByTraceId.has(traceId) || isRootSpan(span)) {
      carrierSpanIdsByTraceId.set(traceId, spanId);
    }
  });
  return carrierSpanIdsByTraceId;
}

function toOtlpAttributes(attributes: AnnotationAttributes): OtlpKeyValue[] {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? { double_value: value }
        : { string_value: value },
  }));
}

function addAnnotationsToPhoenixSpan({
  span,
  spanAnnotations,
  traceAnnotations,
}: {
  span: PhoenixSpan;
  spanAnnotations: SpanAnnotation[];
  traceAnnotations: TraceAnnotation[];
}): PhoenixSpan {
  const annotationAttributes = {
    ...getAnnotationAttributes({
      annotations: spanAnnotations,
      prefix: ANNOTATIONS,
    }),
    ...getAnnotationAttributes({
      annotations: traceAnnotations,
      prefix: TRACE_ANNOTATIONS,
    }),
  };
  if (Object.keys(annotationAttributes).length === 0) {
    return span;
  }
  return {
    ...span,
    attributes: { ...span.attributes, ...annotationAttributes },
  };
}

function addAnnotationsToOtlpSpan({
  span,
  spanAnnotations,
  traceAnnotations,
}: {
  span: OtlpSpan;
  spanAnnotations: SpanAnnotation[];
  traceAnnotations: TraceAnnotation[];
}): OtlpSpan {
  const annotationAttributes = toOtlpAttributes({
    ...getAnnotationAttributes({
      annotations: spanAnnotations,
      prefix: ANNOTATIONS,
    }),
    ...getAnnotationAttributes({
      annotations: traceAnnotations,
      prefix: TRACE_ANNOTATIONS,
    }),
  });
  if (annotationAttributes.length === 0) {
    return span;
  }
  const annotationAttributeKeys = new Set(
    annotationAttributes.map(({ key }) => key)
  );
  return {
    ...span,
    attributes: [
      ...(span.attributes ?? []).filter(
        ({ key }) => key == null || !annotationAttributeKeys.has(key)
      ),
      ...annotationAttributes,
    ],
  };
}

async function fetchAnnotationsForSpans({
  projectId,
  spans,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  spans: Array<PhoenixSpan | OtlpSpan>;
  includeSpanAnnotations: boolean;
  includeTraceAnnotations: boolean;
}): Promise<AnnotationLookup> {
  const spanIds = [
    ...new Set(
      spans
        .map((span) =>
          "context" in span ? span.context.span_id : span.span_id
        )
        .filter((spanId): spanId is string => spanId != null)
    ),
  ];
  const traceIds = [
    ...new Set(
      spans
        .map((span) =>
          "context" in span ? span.context.trace_id : span.trace_id
        )
        .filter((traceId): traceId is string => traceId != null)
    ),
  ];
  const [spanAnnotations, traceAnnotations] = await Promise.all([
    includeSpanAnnotations && spanIds.length > 0
      ? fetchSpanAnnotations({ projectId, spanIds })
      : [],
    includeTraceAnnotations && traceIds.length > 0
      ? fetchTraceAnnotations({ projectId, traceIds })
      : [],
  ]);
  return {
    spanAnnotationsBySpanId: groupAnnotationsByTargetId({
      annotations: spanAnnotations,
      getTargetId: (annotation) => annotation.span_id,
    }),
    traceAnnotationsByTraceId: groupAnnotationsByTargetId({
      annotations: traceAnnotations,
      getTargetId: (annotation) => annotation.trace_id,
    }),
  };
}

/** Downloads blob parts without first joining them into one large JS string. */
function downloadBlob({
  fileName,
  parts,
  type,
}: {
  fileName: string;
  parts: BlobPart[];
  type: string;
}) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY_MS);
}

/** Downloads spans or complete traces in one of the bulk export formats. */
export async function downloadSpanCollection({
  projectId,
  spanIds,
  traceIds,
  format,
  fileName,
  includeSpanAnnotations = true,
  includeTraceAnnotations = true,
}: {
  projectId: string;
  spanIds?: string[];
  traceIds?: string[];
  format: SpanDownloadFormat;
  fileName: string;
  includeSpanAnnotations?: boolean;
  includeTraceAnnotations?: boolean;
}): Promise<void> {
  if (format === "jsonl") {
    const spans: PhoenixSpan[] = [];
    await fetchSpans<PhoenixSpan>({
      spanIds,
      traceIds,
      fetchPage: (query) => fetchSpanPage({ projectId, query }),
      onPage: (pageSpans) => {
        spans.push(...pageSpans);
      },
    });
    const { spanAnnotationsBySpanId, traceAnnotationsByTraceId } =
      await fetchAnnotationsForSpans({
        projectId,
        spans,
        includeSpanAnnotations,
        includeTraceAnnotations,
      });
    const traceAnnotationCarrierSpanIds = getTraceAnnotationCarrierSpanIds({
      spans,
      getSpanId: (span) => span.context.span_id,
      getTraceId: (span) => span.context.trace_id,
      isRootSpan: (span) => span.parent_id == null || span.parent_id === "",
    });
    const serializedSpans = spans.map((span) =>
      JSON.stringify(
        addAnnotationsToPhoenixSpan({
          span,
          spanAnnotations:
            spanAnnotationsBySpanId.get(span.context.span_id) ?? [],
          traceAnnotations:
            traceAnnotationCarrierSpanIds.get(span.context.trace_id) ===
            span.context.span_id
              ? (traceAnnotationsByTraceId.get(span.context.trace_id) ?? [])
              : [],
        })
      )
    );
    downloadBlob({
      fileName,
      parts:
        serializedSpans.length > 0 ? [serializedSpans.join("\n"), "\n"] : [],
      type: "application/x-ndjson",
    });
    return;
  }

  const spans: OtlpSpan[] = [];
  await fetchSpans<OtlpSpan>({
    spanIds,
    traceIds,
    fetchPage: (query) => fetchOtlpSpanPage({ projectId, query }),
    onPage: (pageSpans) => {
      spans.push(...pageSpans);
    },
  });
  const { spanAnnotationsBySpanId, traceAnnotationsByTraceId } =
    await fetchAnnotationsForSpans({
      projectId,
      spans,
      includeSpanAnnotations,
      includeTraceAnnotations,
    });
  const traceAnnotationCarrierSpanIds = getTraceAnnotationCarrierSpanIds({
    spans,
    getSpanId: (span) => span.span_id,
    getTraceId: (span) => span.trace_id,
    isRootSpan: (span) =>
      span.parent_span_id == null || span.parent_span_id === "",
  });
  const spansWithAnnotations = spans.map((span) =>
    addAnnotationsToOtlpSpan({
      span,
      spanAnnotations:
        span.span_id == null
          ? []
          : (spanAnnotationsBySpanId.get(span.span_id) ?? []),
      traceAnnotations:
        span.trace_id != null &&
        traceAnnotationCarrierSpanIds.get(span.trace_id) === span.span_id
          ? (traceAnnotationsByTraceId.get(span.trace_id) ?? [])
          : [],
    })
  );
  downloadBlob({
    fileName,
    parts: [
      JSON.stringify({
        resource_spans: [{ scope_spans: [{ spans: spansWithAnnotations }] }],
      }),
    ],
    type: "application/json",
  });
}

/** Downloads one span as Phoenix JSON or an OTLP JSON export. */
export async function downloadSingleSpan({
  projectId,
  spanId,
  format,
  fileName,
  includeSpanAnnotations = true,
  includeTraceAnnotations = true,
}: {
  projectId: string;
  spanId: string;
  format: SingleSpanDownloadFormat;
  fileName: string;
  includeSpanAnnotations?: boolean;
  includeTraceAnnotations?: boolean;
}): Promise<void> {
  if (format === "otlp-json") {
    await downloadSpanCollection({
      projectId,
      spanIds: [spanId],
      format,
      fileName,
      includeSpanAnnotations,
      includeTraceAnnotations,
    });
    return;
  }

  const page = await fetchSpanPage({
    projectId,
    query: { limit: 1, span_id: [spanId] },
  });
  const span = page.data[0];
  if (span == null) {
    throw new Error("Span not found");
  }
  const { spanAnnotationsBySpanId, traceAnnotationsByTraceId } =
    await fetchAnnotationsForSpans({
      projectId,
      spans: [span],
      includeSpanAnnotations,
      includeTraceAnnotations,
    });
  const spanWithAnnotations = addAnnotationsToPhoenixSpan({
    span,
    spanAnnotations: spanAnnotationsBySpanId.get(span.context.span_id) ?? [],
    traceAnnotations:
      traceAnnotationsByTraceId.get(span.context.trace_id) ?? [],
  });
  downloadBlob({
    fileName,
    parts: [JSON.stringify(spanWithAnnotations, null, 2), "\n"],
    type: "application/json",
  });
}
