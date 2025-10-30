import invariant from "tiny-invariant";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { ExperimentInfo } from "../types/experiments";

export type CreateExperimentParams = ClientFn & {
  /**
   * The dataset ID to create the experiment for
   */
  datasetId: string;
  /**
   * The dataset version ID (if omitted, the latest version will be used)
   */
  datasetVersionId?: string;
  /**
   * The name of the experiment (if omitted, a random name will be generated)
   */
  experimentName?: string;
  /**
   * An optional description of the experiment
   */
  experimentDescription?: string;
  /**
   * Metadata for the experiment
   */
  experimentMetadata?: Record<string, unknown>;
  /**
   * List of dataset split identifiers (GlobalIDs or names) to filter by
   */
  splits?: readonly string[];
  /**
   * Number of times the experiment should be repeated for each example
   * @default 1
   */
  repetitions?: number;
};

/**
 * Create a new experiment without running it.
 * This creates an experiment record that can later be executed using resumeExperiment.
 */
export async function createExperiment({
  client: _client,
  datasetId,
  datasetVersionId,
  experimentName,
  experimentDescription,
  experimentMetadata = {},
  splits,
  repetitions = 1,
}: CreateExperimentParams): Promise<ExperimentInfo> {
  const client = _client || createClient();

  const experimentResponse = await client
    .POST("/v1/datasets/{dataset_id}/experiments", {
      params: {
        path: {
          dataset_id: datasetId,
        },
      },
      body: {
        name: experimentName,
        description: experimentDescription,
        metadata: experimentMetadata,
        repetitions,
        ...(datasetVersionId ? { version_id: datasetVersionId } : {}),
        ...(splits ? { splits: [...splits] } : {}),
      },
    })
    .then((res) => res.data?.data);

  invariant(experimentResponse, `Failed to create experiment`);

  return {
    id: experimentResponse.id,
    datasetId: experimentResponse.dataset_id,
    datasetVersionId: experimentResponse.dataset_version_id,
    datasetSplits: splits ? [...splits] : [],
    repetitions: experimentResponse.repetitions,
    metadata: experimentResponse.metadata || {},
    projectName: experimentResponse.project_name ?? null,
    createdAt: experimentResponse.created_at,
    updatedAt: experimentResponse.updated_at,
    exampleCount: experimentResponse.example_count,
    successfulRunCount: experimentResponse.successful_run_count,
    failedRunCount: experimentResponse.failed_run_count,
    missingRunCount: experimentResponse.missing_run_count,
  };
}
