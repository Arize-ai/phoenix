import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { type ExperimentInfo } from "../types/experiments";

import invariant from "tiny-invariant";

export type GetExperimentParams = ClientFn & {
  /**
   * The experiment ID
   */
  experimentId: string;
};

/**
 * Returns an object containing the high-level info about an experiment
 */
export async function getExperimentInfo({
  client: _client,
  experimentId: experiment_id,
}: GetExperimentParams): Promise<ExperimentInfo> {
  const client = _client || createClient();
  const { data: { data: experimentData } = { data: undefined } } =
    await client.GET("/v1/experiments/{experiment_id}", {
      params: {
        path: {
          experiment_id,
        },
      },
    });
  invariant(experimentData, "Failed to get experiment");
  return {
    id: experimentData.id,
    datasetId: experimentData.dataset_id,
    datasetVersionId: experimentData.dataset_version_id,
    repetitions: experimentData.repetitions,
    metadata: experimentData.metadata || {},
    projectName: experimentData.project_name || null,
    createdAt: experimentData.created_at,
    updatedAt: experimentData.updated_at,
    exampleCount: experimentData.example_count,
    successfulRunCount: experimentData.successful_run_count,
    failedRunCount: experimentData.failed_run_count,
    missingRunCount: experimentData.missing_run_count,
  };
}
