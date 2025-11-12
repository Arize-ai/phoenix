import { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { ExperimentInfo } from "../types/experiments";

import invariant from "tiny-invariant";

export type ListExperimentsParams = ClientFn & {
  /**
   * The dataset ID to list experiments for
   */
  datasetId: string;
};

const DEFAULT_PAGE_SIZE = 50;

/**
 * List all experiments for a dataset with automatic pagination handling.
 *
 * This function automatically handles pagination behind the scenes and returns
 * a simple list of experiments.
 *
 * @example
 * ```ts
 * import { listExperiments } from "@arizeai/phoenix-client/experiments";
 *
 * const experiments = await listExperiments({
 *   datasetId: "dataset_123",
 * });
 *
 * for (const experiment of experiments) {
 *   console.log(`Experiment: ${experiment.id}, Runs: ${experiment.successfulRunCount}`);
 * }
 * ```
 */
export async function listExperiments({
  client: _client,
  datasetId,
}: ListExperimentsParams): Promise<ExperimentInfo[]> {
  const client = _client || createClient();

  const experiments: ExperimentInfo[] = [];
  let cursor: string | null = null;

  do {
    const res: {
      data?: components["schemas"]["ListExperimentsResponseBody"];
    } = await client.GET("/v1/datasets/{dataset_id}/experiments", {
      params: {
        path: {
          dataset_id: datasetId,
        },
        query: {
          cursor,
          limit: DEFAULT_PAGE_SIZE,
        },
      },
    });

    cursor = res.data?.next_cursor || null;
    const data = res.data?.data;
    invariant(data, "Failed to list experiments");

    experiments.push(
      ...data.map((exp) => ({
        id: exp.id,
        datasetId: exp.dataset_id,
        datasetVersionId: exp.dataset_version_id,
        repetitions: exp.repetitions,
        metadata: exp.metadata || {},
        projectName: exp.project_name || null,
        createdAt: exp.created_at,
        updatedAt: exp.updated_at,
        exampleCount: exp.example_count,
        successfulRunCount: exp.successful_run_count,
        failedRunCount: exp.failed_run_count,
        missingRunCount: exp.missing_run_count,
      }))
    );
  } while (cursor != null);

  return experiments;
}
