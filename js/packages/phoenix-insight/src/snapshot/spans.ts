import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling } from "./client.js";

export interface SnapshotSpansOptions {
  /** Inclusive lower bound time for filtering spans */
  startTime?: Date | string | null;
  /** Exclusive upper bound time for filtering spans */
  endTime?: Date | string | null;
  /** Maximum number of spans to fetch per project (default: 1000) */
  spansPerProject?: number;
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

interface ProjectMetadata {
  name: string;
}

/**
 * Fetches spans for all projects and writes them to the snapshot
 *
 * @param client - Phoenix client instance
 * @param mode - Execution mode for file operations
 * @param options - Options for filtering and limiting spans
 */
export async function snapshotSpans(
  client: PhoenixClient,
  mode: ExecutionMode,
  options: SnapshotSpansOptions = {}
): Promise<void> {
  const { startTime, endTime, spansPerProject = 1000 } = options;

  // Read projects index to get project names
  const projectsIndexContent = await mode.exec(
    "cat /phoenix/projects/index.jsonl"
  );
  if (!projectsIndexContent.stdout) {
    // No projects, nothing to do
    return;
  }

  const projectNames = projectsIndexContent.stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const project = JSON.parse(line) as ProjectMetadata;
      return project.name;
    });

  // Fetch spans for each project
  for (const projectName of projectNames) {
    await withErrorHandling(async () => {
      const spans: SpanData[] = [];
      let cursor: string | null = null;
      let totalFetched = 0;

      // Paginate through spans until we reach the limit or no more data
      while (totalFetched < spansPerProject) {
        const query: Record<string, any> = {
          limit: Math.min(100, spansPerProject - totalFetched), // Fetch in chunks of 100
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
                project_identifier: projectName,
              },
              query,
            },
          }
        );

        if (response.error) throw response.error;

        const data = response.data?.data ?? [];
        spans.push(...(data as SpanData[]));
        totalFetched += data.length;

        cursor = response.data?.next_cursor ?? null;

        // Stop if there's no more data
        if (!cursor || data.length === 0) {
          break;
        }
      }

      // Write spans to JSONL file
      const jsonlContent = spans.map((span) => JSON.stringify(span)).join("\n");
      await mode.writeFile(
        `/phoenix/projects/${projectName}/spans/index.jsonl`,
        jsonlContent
      );

      // Write metadata about the spans snapshot
      const metadata = {
        project: projectName,
        spanCount: spans.length,
        startTime: startTime || null,
        endTime: endTime || null,
        snapshotTime: new Date().toISOString(),
      };

      await mode.writeFile(
        `/phoenix/projects/${projectName}/spans/metadata.json`,
        JSON.stringify(metadata, null, 2)
      );
    }, `fetching spans for project ${projectName}`);
  }
}
