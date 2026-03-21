import type {
  PhoenixClient,
  Types,
  componentsV1,
} from "@arizeai/phoenix-client";
import {
  getSpans,
  type GetSpansParams,
  type SpanKindFilter,
  type SpanStatusCode,
} from "@arizeai/phoenix-client/spans";

import { requireIdentifier } from "./identifiers.js";
import { getResponseData } from "./responseUtils.js";
import type { SpanAnnotation, SpanWithAnnotations } from "./traceUtils.js";

type Span = componentsV1["schemas"]["Span"];
type ProjectSpansRequest = Omit<GetSpansParams, "client" | "project">;

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_SPAN_IDS_CHUNK_SIZE = 100;
const DEFAULT_MAX_CONCURRENT = 5;

type SpanAnnotationsQuery = NonNullable<
  Types["V1"]["operations"]["listSpanAnnotationsBySpanIds"]["parameters"]["query"]
>;

export interface SpanFilterInput {
  cursor?: string;
  limit?: number;
  startTime?: string;
  endTime?: string;
  traceIds?: string[];
  parentId?: string | null;
  names?: string[];
  spanKinds?: SpanKindFilter[];
  statusCodes?: SpanStatusCode[];
}

/**
 * Translate MCP span filters into the `phoenix-client` spans helper shape.
 */
export function buildProjectSpansRequest({
  cursor,
  limit,
  startTime,
  endTime,
  traceIds,
  parentId,
  names,
  spanKinds,
  statusCodes,
}: SpanFilterInput): ProjectSpansRequest {
  const request: ProjectSpansRequest = {};

  if (cursor) {
    request.cursor = cursor;
  }
  if (limit !== undefined) {
    request.limit = limit;
  }
  if (startTime) {
    request.startTime = startTime;
  }
  if (endTime) {
    request.endTime = endTime;
  }
  if (traceIds && traceIds.length > 0) {
    request.traceIds = traceIds;
  }
  if (parentId !== undefined) {
    request.parentId = parentId;
  }
  if (names && names.length > 0) {
    request.name = names;
  }
  if (spanKinds && spanKinds.length > 0) {
    request.spanKind = spanKinds;
  }
  if (statusCodes && statusCodes.length > 0) {
    request.statusCode = statusCodes;
  }

  return request;
}

/**
 * Resolve the lower bound start time for trace and span listing tools.
 */
export function resolveStartTime({
  since,
  lastNMinutes,
  now = new Date(),
}: {
  since?: string;
  lastNMinutes?: number;
  now?: Date;
}): string | undefined {
  if (since) {
    return since;
  }
  if (lastNMinutes === undefined) {
    return undefined;
  }

  return new Date(now.getTime() - lastNMinutes * 60 * 1000).toISOString();
}

/**
 * Fetch spans for a project with MCP-specific pagination and limit handling.
 */
export async function fetchProjectSpans({
  client,
  projectIdentifier,
  filters,
  totalLimit,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  filters: SpanFilterInput;
  totalLimit?: number;
}): Promise<{ spans: Span[]; nextCursor: string | null }> {
  const normalizedProjectIdentifier = requireIdentifier({
    identifier: projectIdentifier,
    label: "projectIdentifier",
  });
  const collectedSpans: Span[] = [];
  let cursor: string | undefined = filters.cursor;
  const pageLimit = Math.min(totalLimit || filters.limit || 100, 1000);

  do {
    const response = await getSpans({
      client,
      project: { project: normalizedProjectIdentifier },
      ...buildProjectSpansRequest({
        ...filters,
        cursor,
        limit: pageLimit,
      }),
    });

    collectedSpans.push(...response.spans);
    cursor = response.nextCursor || undefined;

    if (totalLimit !== undefined && collectedSpans.length >= totalLimit) {
      return {
        spans: collectedSpans.slice(0, totalLimit),
        nextCursor: cursor || null,
      };
    }
  } while (cursor);

  return {
    spans: collectedSpans,
    nextCursor: cursor || null,
  };
}

function chunkArray<TValue>(values: TValue[], size: number): TValue[][] {
  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

/**
 * Fetch all span annotation pages for a single chunk of span IDs.
 */
async function fetchSpanAnnotationsForChunk({
  client,
  projectIdentifier,
  spanIds,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  spanIds: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit: number;
}): Promise<SpanAnnotation[]> {
  const annotations: SpanAnnotation[] = [];
  let cursor: string | undefined;

  do {
    const query: SpanAnnotationsQuery = {
      span_ids: spanIds,
      limit: pageLimit,
    };

    if (cursor) {
      query.cursor = cursor;
    }
    if (includeAnnotationNames && includeAnnotationNames.length > 0) {
      query.include_annotation_names = includeAnnotationNames;
    }
    if (excludeAnnotationNames && excludeAnnotationNames.length > 0) {
      query.exclude_annotation_names = excludeAnnotationNames;
    }

    const response = await client.GET(
      "/v1/projects/{project_identifier}/span_annotations",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query,
        },
      }
    );

    const data = getResponseData({
      response,
      errorPrefix: `Failed to fetch span annotations for project "${projectIdentifier}"`,
    });

    annotations.push(...data.data);
    cursor = data.next_cursor || undefined;
  } while (cursor);

  return annotations;
}

/**
 * Fetch span annotations in chunks to avoid overloading the annotations route.
 */
export async function fetchSpanAnnotations({
  client,
  projectIdentifier,
  spanIds,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  spanIds: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit?: number;
  maxConcurrent?: number;
}): Promise<SpanAnnotation[]> {
  if (spanIds.length === 0) {
    return [];
  }

  const normalizedProjectIdentifier = requireIdentifier({
    identifier: projectIdentifier,
    label: "projectIdentifier",
  });
  const uniqueSpanIds = Array.from(new Set(spanIds));
  const chunks = chunkArray(uniqueSpanIds, DEFAULT_SPAN_IDS_CHUNK_SIZE);
  const allAnnotations: SpanAnnotation[] = [];

  for (
    let chunkIndex = 0;
    chunkIndex < chunks.length;
    chunkIndex += maxConcurrent
  ) {
    const batch = chunks.slice(chunkIndex, chunkIndex + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((spanIdsChunk) =>
        fetchSpanAnnotationsForChunk({
          client,
          projectIdentifier: normalizedProjectIdentifier,
          spanIds: spanIdsChunk,
          includeAnnotationNames,
          excludeAnnotationNames,
          pageLimit,
        })
      )
    );

    for (const batchResult of batchResults) {
      allAnnotations.push(...batchResult);
    }
  }

  return allAnnotations;
}

export function attachAnnotationsToSpans({
  spans,
  annotations,
}: {
  spans: Span[];
  annotations: SpanAnnotation[];
}): SpanWithAnnotations[] {
  const annotationsBySpanId = new Map<string, SpanAnnotation[]>();

  for (const annotation of annotations) {
    const spanAnnotations = annotationsBySpanId.get(annotation.span_id);
    if (spanAnnotations) {
      spanAnnotations.push(annotation);
    } else {
      annotationsBySpanId.set(annotation.span_id, [annotation]);
    }
  }

  return spans.map((span) => {
    const spanId = span.context?.span_id;
    const spanAnnotations = spanId
      ? annotationsBySpanId.get(spanId)
      : undefined;

    if (!spanAnnotations || spanAnnotations.length === 0) {
      return span;
    }

    return {
      ...span,
      annotations: spanAnnotations,
    };
  });
}
