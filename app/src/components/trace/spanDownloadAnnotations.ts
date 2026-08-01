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

type Annotation = SpanAnnotation | TraceAnnotation;
type AnnotationAttributeValue = string | number;
type AnnotationAttributes = Record<string, AnnotationAttributeValue>;

type AnnotationSearchQuery = {
  limit: number;
  cursor?: string;
};

type AnnotationPage<Annotation> = {
  data: Annotation[];
  next_cursor?: string | null;
};

export type SpanAnnotationTarget = {
  spanId: string;
  traceId: string;
  isRoot: boolean;
};

export type AnnotationLookup = {
  spanAnnotationsBySpanId: Map<string, SpanAnnotation[]>;
  traceAnnotationsByTraceId: Map<string, TraceAnnotation[]>;
};

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

/** Fetches annotations in bounded ID batches and follows every cursor. */
async function fetchAnnotations<Annotation>({
  ids,
  fetchPage,
}: {
  ids: string[];
  fetchPage: (params: {
    ids: string[];
    query: AnnotationSearchQuery;
  }) => Promise<AnnotationPage<Annotation>>;
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

function groupAnnotationsByTargetId<Annotation>({
  annotations,
  getTargetId,
}: {
  annotations: Annotation[];
  getTargetId: (annotation: Annotation) => string;
}): Map<string, Annotation[]> {
  const annotationsByTargetId = new Map<string, Annotation[]>();
  for (const annotation of annotations) {
    const targetId = getTargetId(annotation);
    const targetAnnotations = annotationsByTargetId.get(targetId) ?? [];
    targetAnnotations.push(annotation);
    annotationsByTargetId.set(targetId, targetAnnotations);
  }
  return annotationsByTargetId;
}

/**
 * Picks one carrier span per trace for trace-level annotations (prefer root).
 * First-seen wins unless a later span is a root.
 */
function getTraceAnnotationCarrierSpanIds(
  targets: SpanAnnotationTarget[]
): Map<string, string> {
  const carrierSpanIdsByTraceId = new Map<string, string>();
  for (const target of targets) {
    if (!carrierSpanIdsByTraceId.has(target.traceId) || target.isRoot) {
      carrierSpanIdsByTraceId.set(target.traceId, target.spanId);
    }
  }
  return carrierSpanIdsByTraceId;
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

/** Builds OpenInference annotation attributes for one span. */
function buildAnnotationAttributes({
  spanAnnotations,
  traceAnnotations,
}: {
  spanAnnotations: SpanAnnotation[];
  traceAnnotations: TraceAnnotation[];
}): AnnotationAttributes {
  return {
    ...getAnnotationAttributes({
      annotations: spanAnnotations,
      prefix: ANNOTATIONS,
    }),
    ...getAnnotationAttributes({
      annotations: traceAnnotations,
      prefix: TRACE_ANNOTATIONS,
    }),
  };
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

export function addAnnotationsToPhoenixSpan({
  span,
  spanAnnotations,
  traceAnnotations,
}: {
  span: PhoenixSpan;
  spanAnnotations: SpanAnnotation[];
  traceAnnotations: TraceAnnotation[];
}): PhoenixSpan {
  const annotationAttributes = buildAnnotationAttributes({
    spanAnnotations,
    traceAnnotations,
  });
  if (Object.keys(annotationAttributes).length === 0) {
    return span;
  }
  return {
    ...span,
    attributes: { ...span.attributes, ...annotationAttributes },
  };
}

export function addAnnotationsToOtlpSpan({
  span,
  spanAnnotations,
  traceAnnotations,
}: {
  span: OtlpSpan;
  spanAnnotations: SpanAnnotation[];
  traceAnnotations: TraceAnnotation[];
}): OtlpSpan {
  const annotationAttributes = toOtlpAttributes(
    buildAnnotationAttributes({ spanAnnotations, traceAnnotations })
  );
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

/** Loads span/trace annotations for the given download targets. */
export async function fetchAnnotationsForTargets({
  projectId,
  targets,
  includeSpanAnnotations,
  includeTraceAnnotations,
}: {
  projectId: string;
  targets: SpanAnnotationTarget[];
  includeSpanAnnotations: boolean;
  includeTraceAnnotations: boolean;
}): Promise<AnnotationLookup> {
  const spanIds = [...new Set(targets.map((target) => target.spanId))];
  const traceIds = [...new Set(targets.map((target) => target.traceId))];
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

/**
 * Attaches fetched annotations to spans. Trace annotations land once per
 * trace on the carrier span (preferring the root).
 */
export function applyAnnotationsToSpans<Span>({
  spans,
  targets,
  lookup,
  withAnnotations,
}: {
  spans: Span[];
  /** Target for each span, positionally aligned with `spans`. */
  targets: (SpanAnnotationTarget | null)[];
  lookup: AnnotationLookup;
  withAnnotations: (
    span: Span,
    spanAnnotations: SpanAnnotation[],
    traceAnnotations: TraceAnnotation[]
  ) => Span;
}): Span[] {
  const carrierSpanIdsByTraceId = getTraceAnnotationCarrierSpanIds(
    targets.filter((target): target is SpanAnnotationTarget => target != null)
  );
  return spans.map((span, index) => {
    const target = targets[index];
    if (target == null) {
      return withAnnotations(span, [], []);
    }
    const spanAnnotations =
      lookup.spanAnnotationsBySpanId.get(target.spanId) ?? [];
    const isCarrier =
      carrierSpanIdsByTraceId.get(target.traceId) === target.spanId;
    const traceAnnotations = isCarrier
      ? (lookup.traceAnnotationsByTraceId.get(target.traceId) ?? [])
      : [];
    return withAnnotations(span, spanAnnotations, traceAnnotations);
  });
}
