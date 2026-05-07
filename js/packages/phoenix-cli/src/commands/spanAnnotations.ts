import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

import { chunkArray } from "./chunkArray";

export type SpanAnnotation = componentsV1["schemas"]["SpanAnnotation"];

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_SPAN_IDS_CHUNK_SIZE = 100;
const DEFAULT_MAX_CONCURRENT = 5;

interface FetchSpanAnnotationsOptions {
  client: PhoenixClient;
  projectIdentifier: string;
  /**
   * Optional list of span IDs to filter by. Mutually compatible with `identifier`.
   * Either `spanIds` or `identifier` (or both) must be supplied.
   */
  spanIds?: string[];
  /**
   * Optional list of annotation identifiers to filter by. Mutually compatible
   * with `spanIds`. Either `spanIds` or `identifier` (or both) must be supplied.
   */
  identifier?: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit?: number;
  maxConcurrent?: number;
}

async function fetchSpanAnnotationsForChunk({
  client,
  projectIdentifier,
  spanIds,
  identifier,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  spanIds?: string[];
  identifier?: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit: number;
}): Promise<SpanAnnotation[]> {
  const annotations: SpanAnnotation[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.GET(
      "/v1/projects/{project_identifier}/span_annotations",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query: {
            span_ids: spanIds,
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
        `Failed to fetch span annotations: ${String(response.error)}`
      );
    }

    annotations.push(...response.data.data);
    cursor = response.data.next_cursor || undefined;
  } while (cursor);

  return annotations;
}

export async function fetchSpanAnnotations({
  client,
  projectIdentifier,
  spanIds,
  identifier,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: FetchSpanAnnotationsOptions): Promise<SpanAnnotation[]> {
  const hasSpanIds = spanIds !== undefined && spanIds.length > 0;
  const hasIdentifier = identifier !== undefined && identifier.length > 0;

  if (!hasSpanIds && !hasIdentifier) {
    return [];
  }

  // No span IDs to chunk over → run a single non-chunked pagination pass
  // using the identifier filter alone.
  if (!hasSpanIds) {
    return fetchSpanAnnotationsForChunk({
      client,
      projectIdentifier,
      identifier,
      includeAnnotationNames,
      excludeAnnotationNames,
      pageLimit,
    });
  }

  const uniqueSpanIds = Array.from(new Set(spanIds));
  const chunks = chunkArray({
    items: uniqueSpanIds,
    size: DEFAULT_SPAN_IDS_CHUNK_SIZE,
  });
  const allAnnotations: SpanAnnotation[] = [];

  for (let index = 0; index < chunks.length; index += maxConcurrent) {
    const batch = chunks.slice(index, index + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((spanIdsChunk) =>
        fetchSpanAnnotationsForChunk({
          client,
          projectIdentifier,
          spanIds: spanIdsChunk,
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
