import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling, extractData } from "./client.js";

interface Dataset {
  id: string;
  name: string;
}

interface Experiment {
  id: string;
  dataset_id: string;
  dataset_version_id: string;
  repetitions: number;
  metadata: Record<string, unknown>;
  project_name: string | null;
  created_at: string;
  updated_at: string;
  example_count: number;
  successful_run_count: number;
  failed_run_count: number;
  missing_run_count: number;
}

interface ExperimentRun {
  id: string;
  experiment_id: string;
  dataset_example_id: string;
  start_time: string;
  end_time: string;
  output: unknown;
  error?: string | null;
  trace_id?: string | null;
  repetition_number?: number;
}

interface FetchExperimentsOptions {
  /**
   * Maximum number of experiments to fetch per dataset
   */
  limit?: number;
  /**
   * Include experiment runs in the snapshot
   */
  includeRuns?: boolean;
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
 * Fetches all experiments and their runs from Phoenix
 * Note: Experiments are fetched per dataset since there's no direct "all experiments" endpoint
 */
export async function fetchExperiments(
  client: PhoenixClient,
  mode: ExecutionMode,
  options: FetchExperimentsOptions = {}
): Promise<void> {
  const { limit = 100, includeRuns = true } = options;

  // First, we need to get all datasets to fetch their experiments
  const datasetsResponse = await withErrorHandling(
    () => client.GET("/v1/datasets", { params: { query: { limit: 1000 } } }),
    "fetching datasets for experiments"
  );

  const datasetsData = extractData(datasetsResponse);
  const datasets: Dataset[] = datasetsData.data;

  // Collect all experiments from all datasets
  const allExperiments: Array<Experiment & { datasetName: string }> = [];

  for (const dataset of datasets) {
    try {
      // Fetch experiments for this dataset with pagination
      const experiments: Experiment[] = [];
      let cursor: string | null = null;

      do {
        const response = await withErrorHandling(
          () =>
            client.GET("/v1/datasets/{dataset_id}/experiments", {
              params: {
                path: {
                  dataset_id: dataset.id,
                },
                query: {
                  cursor,
                  limit: 50,
                },
              },
            }),
          `fetching experiments for dataset ${dataset.name}`
        );

        const data = extractData(response);
        experiments.push(...(data.data || []));
        cursor = data.next_cursor || null;

        // Stop if we've reached the overall limit
        if (allExperiments.length + experiments.length >= limit) {
          const remaining = limit - allExperiments.length;
          experiments.splice(remaining);
          cursor = null;
        }
      } while (cursor != null);

      // Add dataset name to each experiment for context
      const experimentsWithDatasetName = experiments.map((exp) => ({
        ...exp,
        datasetName: dataset.name,
      }));

      allExperiments.push(...experimentsWithDatasetName);

      // Apply limit if specified
      if (allExperiments.length >= limit) {
        break;
      }
    } catch (error) {
      // If fetching experiments for a dataset fails, log and continue
      console.warn(
        `Failed to fetch experiments for dataset ${dataset.name}:`,
        error
      );
    }
  }

  // Write experiments index
  await mode.writeFile(
    "/phoenix/experiments/index.jsonl",
    toJSONL(allExperiments)
  );

  // Fetch runs for each experiment if requested
  if (includeRuns) {
    for (const experiment of allExperiments) {
      try {
        // Write experiment metadata
        await mode.writeFile(
          `/phoenix/experiments/${experiment.id}/metadata.json`,
          JSON.stringify(
            {
              id: experiment.id,
              dataset_id: experiment.dataset_id,
              dataset_name: experiment.datasetName,
              dataset_version_id: experiment.dataset_version_id,
              repetitions: experiment.repetitions,
              metadata: experiment.metadata,
              project_name: experiment.project_name,
              created_at: experiment.created_at,
              updated_at: experiment.updated_at,
              example_count: experiment.example_count,
              successful_run_count: experiment.successful_run_count,
              failed_run_count: experiment.failed_run_count,
              missing_run_count: experiment.missing_run_count,
              snapshot_timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );

        // Fetch runs for this experiment with pagination
        const runs: ExperimentRun[] = [];
        let cursor: string | null = null;

        do {
          const runsResponse = await withErrorHandling(
            () =>
              client.GET("/v1/experiments/{experiment_id}/runs", {
                params: {
                  path: {
                    experiment_id: experiment.id,
                  },
                  query: {
                    cursor,
                    limit: 100,
                  },
                },
              }),
            `fetching runs for experiment ${experiment.id}`
          );

          const runsData = extractData(runsResponse);
          runs.push(...(runsData.data || []));
          cursor = runsData.next_cursor || null;
        } while (cursor != null);

        // Write runs as JSONL
        await mode.writeFile(
          `/phoenix/experiments/${experiment.id}/runs.jsonl`,
          toJSONL(runs)
        );

        // Write experiment summary with run stats
        await mode.writeFile(
          `/phoenix/experiments/${experiment.id}/summary.json`,
          JSON.stringify(
            {
              experiment_id: experiment.id,
              dataset_name: experiment.datasetName,
              project_name: experiment.project_name,
              total_runs: runs.length,
              successful_runs: experiment.successful_run_count,
              failed_runs: experiment.failed_run_count,
              missing_runs: experiment.missing_run_count,
              created_at: experiment.created_at,
              updated_at: experiment.updated_at,
            },
            null,
            2
          )
        );
      } catch (error) {
        // If fetching runs for an experiment fails, log and continue
        console.warn(
          `Failed to fetch runs for experiment ${experiment.id}:`,
          error
        );

        // Still create the experiment metadata without runs
        await mode.writeFile(
          `/phoenix/experiments/${experiment.id}/metadata.json`,
          JSON.stringify(
            {
              ...experiment,
              error: "Failed to fetch runs",
              snapshot_timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );
      }
    }
  }
}
