import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling, extractData } from "./client.js";

interface Dataset {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface DatasetExample {
  id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
}

interface FetchDatasetsOptions {
  limit?: number;
}

/**
 * Converts an array to JSONL format
 */
function toJSONL(items: unknown[]): string {
  if (items.length === 0) {
    return "";
  }
  return items.map((item) => JSON.stringify(item)).join("\n");
}

/**
 * Fetches all datasets and their examples from Phoenix
 */
export async function fetchDatasets(
  client: PhoenixClient,
  mode: ExecutionMode,
  options: FetchDatasetsOptions = {}
): Promise<void> {
  const { limit = 100 } = options;

  // Fetch all datasets with pagination
  const datasets: Dataset[] = [];
  let cursor: string | null = null;

  while (datasets.length < limit) {
    const query: Record<string, unknown> = {
      limit: Math.min(limit - datasets.length, 100),
    };
    if (cursor) {
      query.cursor = cursor;
    }

    const response = await withErrorHandling(
      () => client.GET("/v1/datasets", { params: { query } }),
      "fetching datasets"
    );

    const data = extractData(response);
    datasets.push(...data.data);
    cursor = data.next_cursor;

    // Stop if no more data
    if (!cursor || data.data.length === 0) {
      break;
    }
  }

  // Write datasets index
  await mode.writeFile("/phoenix/datasets/index.jsonl", toJSONL(datasets));

  // Fetch examples for each dataset
  for (const dataset of datasets) {
    // Write dataset metadata
    await mode.writeFile(
      `/phoenix/datasets/${dataset.name}/metadata.json`,
      JSON.stringify(
        {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          metadata: dataset.metadata,
          created_at: dataset.created_at,
          updated_at: dataset.updated_at,
          snapshot_timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    // Fetch examples for this dataset
    const examplesResponse = await withErrorHandling(
      () =>
        client.GET("/v1/datasets/{id}/examples", {
          params: {
            path: { id: dataset.id },
          },
        }),
      `fetching examples for dataset ${dataset.name}`
    );

    const examplesData = extractData(examplesResponse);
    const examples = examplesData.data.examples;

    // Write examples as JSONL
    await mode.writeFile(
      `/phoenix/datasets/${dataset.name}/examples.jsonl`,
      toJSONL(examples)
    );

    // Write dataset info with example count
    await mode.writeFile(
      `/phoenix/datasets/${dataset.name}/info.json`,
      JSON.stringify(
        {
          dataset_id: dataset.id,
          dataset_name: dataset.name,
          example_count: examples.length,
          version_id: examplesData.data.version_id,
          filtered_splits: examplesData.data.filtered_splits,
        },
        null,
        2
      )
    );
  }
}
