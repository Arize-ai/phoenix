import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

export type SpanAnnotation = componentsV1["schemas"]["SpanAnnotation"];

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_SPAN_IDS_CHUNK_SIZE = 100;
const DEFAULT_MAX_CONCURRENT = 5;

interface FetchSpanAnnotationsOptions {
  client: PhoenixClient;
  projectIdentifier: string;
  spanIds: string[];
  includeAnnotationNames?: string[];
  excludeAnnotationNames?: string[];
  pageLimit?: number;
  maxConcurrent?: number;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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
    const response = await client.GET(
      "/v1/projects/{project_identifier}/span_annotations",
      {
        params: {
          path: {
            project_identifier: projectIdentifier,
          },
          query: {
            span_ids: spanIds,
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
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: FetchSpanAnnotationsOptions): Promise<SpanAnnotation[]> {
  if (spanIds.length === 0) {
    return [];
  }

  const uniqueSpanIds = Array.from(new Set(spanIds));
  const chunks = chunkArray(uniqueSpanIds, DEFAULT_SPAN_IDS_CHUNK_SIZE);
  const allAnnotations: SpanAnnotation[] = [];

  for (let i = 0; i < chunks.length; i += maxConcurrent) {
    const batch = chunks.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((spanIdsChunk) =>
        fetchSpanAnnotationsForChunk({
          client,
          projectIdentifier,
          spanIds: spanIdsChunk,
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
