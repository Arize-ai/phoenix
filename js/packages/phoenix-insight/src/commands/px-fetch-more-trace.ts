import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling } from "../snapshot/client.js";

export interface FetchMoreTraceOptions {
  /** Trace ID to fetch all spans for */
  traceId: string;
  /** Project name to search in */
  project: string;
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

/**
 * Fetches all spans for a specific trace ID
 *
 * @param client - Phoenix client instance
 * @param mode - Execution mode for file operations
 * @param options - Options for fetching trace
 */
export async function fetchMoreTrace(
  client: PhoenixClient,
  mode: ExecutionMode,
  options: FetchMoreTraceOptions
): Promise<void> {
  const { traceId, project } = options;

  await withErrorHandling(async () => {
    // First, check if the project exists in our snapshot
    const projectsResult = await mode.exec("cat /phoenix/projects/index.jsonl");
    if (projectsResult.exitCode !== 0 || !projectsResult.stdout) {
      console.error("No projects found in snapshot. Run a snapshot first.");
      return;
    }

    const projectNames = projectsResult.stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line).name);

    if (!projectNames.includes(project)) {
      console.error(
        `Project "${project}" not found. Available projects: ${projectNames.join(
          ", "
        )}`
      );
      return;
    }

    // Fetch all spans that belong to this trace
    const traceSpans: SpanData[] = [];
    let cursor: string | null = null;
    let totalFetched = 0;

    console.log(`Fetching trace ${traceId} from project "${project}"...`);

    // We need to fetch spans in batches and filter by trace_id
    // Since the API doesn't support direct trace_id filtering
    while (true) {
      const query: Record<string, any> = {
        limit: 100, // Fetch in chunks
      };

      if (cursor) {
        query.cursor = cursor;
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
      totalFetched += data.length;

      // Filter spans that belong to our trace
      const matchingSpans = (data as SpanData[]).filter(
        (span) => span.context.trace_id === traceId
      );
      traceSpans.push(...matchingSpans);

      cursor = response.data?.next_cursor ?? null;

      // Stop if we found spans for the trace or no more data
      if (traceSpans.length > 0 || !cursor || data.length === 0) {
        // If we found some spans, continue until we have all spans from the trace
        // This is because trace spans might be spread across multiple pages
        if (traceSpans.length > 0 && cursor && data.length > 0) {
          console.log(
            `Found ${traceSpans.length} spans so far, continuing search...`
          );
          continue;
        }
        break;
      }

      // Show progress for large datasets
      if (totalFetched % 1000 === 0) {
        console.log(`Searched ${totalFetched} spans so far...`);
      }
    }

    if (traceSpans.length === 0) {
      console.log(
        `No spans found for trace ${traceId} in project "${project}"`
      );
      console.log(
        `Searched through ${totalFetched} spans. The trace might not exist or might be in a different project.`
      );
      return;
    }

    // Sort spans by start_time to show them in order
    traceSpans.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    // Write trace spans to a dedicated file
    const jsonlContent = traceSpans
      .map((span) => JSON.stringify(span))
      .join("\n");

    const traceDir = `/phoenix/traces/${traceId}`;
    await mode.writeFile(`${traceDir}/spans.jsonl`, jsonlContent);

    // Create trace metadata
    const rootSpan = traceSpans.find((span) => !span.parent_id);
    const firstSpan = traceSpans[0];
    const lastSpan = traceSpans[traceSpans.length - 1];
    const metadata = {
      traceId,
      project,
      spanCount: traceSpans.length,
      rootSpan: rootSpan ? { id: rootSpan.id, name: rootSpan.name } : null,
      startTime: firstSpan?.start_time || null,
      endTime: lastSpan?.end_time || null,
      duration:
        firstSpan && lastSpan
          ? new Date(lastSpan.end_time).getTime() -
            new Date(firstSpan.start_time).getTime()
          : 0,
      snapshotTime: new Date().toISOString(),
    };

    await mode.writeFile(
      `${traceDir}/metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    console.log(`\nSuccessfully fetched trace ${traceId}:`);
    console.log(`- Project: ${project}`);
    console.log(`- Spans: ${traceSpans.length}`);
    console.log(`- Root span: ${rootSpan?.name || "Unknown"}`);
    console.log(`- Duration: ${(metadata.duration / 1000).toFixed(2)} seconds`);
    console.log(`\nTrace data saved to: ${traceDir}/`);
  }, `fetching trace ${traceId}`);
}
