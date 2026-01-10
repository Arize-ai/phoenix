import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling } from "../snapshot/client.js";

export interface FetchMoreSpansOptions {
  /** Project name to fetch spans for */
  project: string;
  /** Number of additional spans to fetch */
  limit: number;
  /** Inclusive lower bound time for filtering spans */
  startTime?: Date | string | null;
  /** Exclusive upper bound time for filtering spans */
  endTime?: Date | string | null;
}

interface SpanData {
  id: string;
  name: string;
  context: {
    trace_id: string;
    span_id: string;
  };
  span_kind: string;
  parent_id: string | null;
  start_time: string;
  end_time: string;
  status_code: string;
  status_message: string;
  attributes: Record<string, unknown>;
  events: Array<unknown>;
}

interface SpansMetadata {
  project: string;
  spanCount: number;
  startTime: string | null;
  endTime: string | null;
  snapshotTime: string;
  lastCursor?: string | null;
}

/**
 * Fetches additional spans for a specific project on-demand
 *
 * @param client - Phoenix client instance
 * @param mode - Execution mode for file operations
 * @param options - Options for fetching spans
 */
export async function fetchMoreSpans(
  client: PhoenixClient,
  mode: ExecutionMode,
  options: FetchMoreSpansOptions
): Promise<void> {
  const { project, limit, startTime, endTime } = options;

  await withErrorHandling(async () => {
    // Try to read existing metadata to get the last cursor
    let existingMetadata: SpansMetadata | null = null;
    let existingSpans: SpanData[] = [];

    try {
      const metadataResult = await mode.exec(
        `cat /phoenix/projects/${project}/spans/metadata.json`
      );
      if (metadataResult.exitCode === 0 && metadataResult.stdout) {
        existingMetadata = JSON.parse(metadataResult.stdout);
      }
    } catch (error) {
      // Metadata doesn't exist, that's okay
    }

    // Try to read existing spans
    try {
      const spansResult = await mode.exec(
        `cat /phoenix/projects/${project}/spans/index.jsonl`
      );
      if (spansResult.exitCode === 0 && spansResult.stdout) {
        existingSpans = spansResult.stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line) as SpanData);
      }
    } catch (error) {
      // Spans file doesn't exist, that's okay
    }

    // Fetch new spans
    const newSpans: SpanData[] = [];
    let cursor: string | null = existingMetadata?.lastCursor ?? null;
    let totalFetched = 0;

    while (totalFetched < limit) {
      const query: Record<string, any> = {
        limit: Math.min(100, limit - totalFetched), // Fetch in chunks of 100
      };

      if (cursor) {
        query.cursor = cursor;
      }

      if (startTime) {
        query.start_time =
          startTime instanceof Date ? startTime.toISOString() : startTime;
      }

      if (endTime) {
        query.end_time =
          endTime instanceof Date ? endTime.toISOString() : endTime;
      }

      const response = await client.GET(
        "/v1/projects/{project_identifier}/spans",
        {
          params: {
            path: {
              project_identifier: project,
            },
            query,
          },
        }
      );

      if (response.error) throw response.error;

      const data = response.data?.data ?? [];
      newSpans.push(...(data as SpanData[]));
      totalFetched += data.length;

      cursor = response.data?.next_cursor ?? null;

      // Stop if there's no more data
      if (!cursor || data.length === 0) {
        break;
      }
    }

    // Combine existing and new spans
    const allSpans = [...existingSpans, ...newSpans];

    // Write updated spans to JSONL file
    const jsonlContent = allSpans
      .map((span) => JSON.stringify(span))
      .join("\n");
    await mode.writeFile(
      `/phoenix/projects/${project}/spans/index.jsonl`,
      jsonlContent
    );

    // Update metadata
    const metadata: SpansMetadata = {
      project,
      spanCount: allSpans.length,
      startTime:
        startTime instanceof Date
          ? startTime.toISOString()
          : (startTime ?? null),
      endTime:
        endTime instanceof Date ? endTime.toISOString() : (endTime ?? null),
      snapshotTime: new Date().toISOString(),
      lastCursor: cursor,
    };

    await mode.writeFile(
      `/phoenix/projects/${project}/spans/metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    console.log(
      `Fetched ${newSpans.length} additional spans for project "${project}"`
    );
    console.log(`Total spans for project: ${allSpans.length}`);
  }, `fetching more spans for project ${project}`);
}
