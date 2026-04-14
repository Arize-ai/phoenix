import type { componentsV1, PhoenixClient } from "@arizeai/phoenix-client";

export type TraceAnnotation = componentsV1["schemas"]["TraceAnnotation"];

const DEFAULT_PAGE_LIMIT = 1000;
const DEFAULT_TRACE_IDS_CHUNK_SIZE = 100;
const DEFAULT_MAX_CONCURRENT = 5;

interface FetchTraceAnnotationsOptions {
  client: PhoenixClient;
  projectIdentifier: string;
  traceIds: string[];
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

async function fetchTraceAnnotationsForChunk({
  client,
  projectIdentifier,
  traceIds,
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit,
}: {
  client: PhoenixClient;
  projectIdentifier: string;
  traceIds: string[];
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
  includeAnnotationNames,
  excludeAnnotationNames,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}: FetchTraceAnnotationsOptions): Promise<TraceAnnotation[]> {
  if (traceIds.length === 0) {
    return [];
  }

  const uniqueTraceIds = Array.from(new Set(traceIds));
  const chunks = chunkArray(uniqueTraceIds, DEFAULT_TRACE_IDS_CHUNK_SIZE);
  const allAnnotations: TraceAnnotation[] = [];

  for (let i = 0; i < chunks.length; i += maxConcurrent) {
    const batch = chunks.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((traceIdsChunk) =>
        fetchTraceAnnotationsForChunk({
          client,
          projectIdentifier,
          traceIds: traceIdsChunk,
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
