import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

import { chunkArray } from "./chunkArray";

export type TraceAnnotation = componentsV1["schemas"]["TraceAnnotation"];

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_TRACE_IDS_CHUNK_SIZE = 100;
const DEFAULT_MAX_CONCURRENT = 5;

interface FetchTraceAnnotationsOptions {
  client: PhoenixClient;
  projectIdentifier: string;
  /**
   * Optional list of trace IDs to filter by. Mutually compatible with `identifier`.
   * Either `traceIds` or `identifier` (or both) must be supplied.
   */
  traceIds?: string[];
  /**
   * Optional list of annotation identifiers to filter by. Mutually compatible
   * with `traceIds`. Either `traceIds` or `identifier` (or both) must be supplied.
   */
  identifier?: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit?: number;
  maxConcurrent?: number;
}

async function fetchTraceAnnotationsForChunk({
  client,
  projectIdentifier,
  traceIds,
  identifier,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  traceIds?: string[];
  identifier?: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit: number;
}): Promise<TraceAnnotation[]> {
  const annotations: TraceAnnotation[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.GET(
      "/v1/projects/{project_identifier}/trace_annotations",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query: {
            trace_ids: traceIds,
            identifier,
            cursor,
            limit: pageLimit,
            include_annotation_names: includeAnnotationNames,
            exclude_annotation_names: excludeAnnotationNames,
          },
        },
      }
    );

    if (response.error || !response.data) {
      throw new Error(
        `Failed to fetch trace annotations: ${String(response.error)}`
      );
    }

    annotations.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;
  } while (cursor);

  return annotations;
}

export async function fetchTraceAnnotations({
  client,
  projectIdentifier,
  traceIds,
  identifier,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: FetchTraceAnnotationsOptions): Promise<TraceAnnotation[]> {
  const hasTraceIds = traceIds !== undefined && traceIds.length > 0;
  const hasIdentifier = identifier !== undefined && identifier.length > 0;

  if (!hasTraceIds && !hasIdentifier) {
    return [];
  }

  // No trace IDs to chunk over → run a single non-chunked pagination pass
  // using the identifier filter alone.
  if (!hasTraceIds) {
    return fetchTraceAnnotationsForChunk({
      client,
      projectIdentifier,
      identifier,
      includeAnnotationNames,
      excludeAnnotationNames,
      pageLimit,
    });
  }

  const uniqueTraceIds = Array.from(new Set(traceIds));
  const chunks = chunkArray({
    items: uniqueTraceIds,
    size: DEFAULT_TRACE_IDS_CHUNK_SIZE,
  });
  const allAnnotations: TraceAnnotation[] = [];

  for (let index = 0; index < chunks.length; index += maxConcurrent) {
    const batch = chunks.slice(index, index + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((traceIdsChunk) =>
        fetchTraceAnnotationsForChunk({
          client,
          projectIdentifier,
          traceIds: traceIdsChunk,
          identifier,
          includeAnnotationNames,
          excludeAnnotationNames,
          pageLimit,
        })
      )
    );

    for (const result of batchResults) {
      allAnnotations.push(...result);
    }
  }

  return allAnnotations;
}
