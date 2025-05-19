import invariant from "tiny-invariant";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { type Experiment } from "../types/experiments";

export type GetExperimentParams = ClientFn & {
  /**
   * The experiment ID
   */
  experimentId: string;
};

/**
 * Returns the high-level info about an experiment
 */
export async function getExperiment({
  client: _client,
  experimentId: experiment_id,
}: GetExperimentParams): Promise<Experiment> {
  const client = _client || createClient();
  const { data: { data: experimentData } = {} } = await client.GET(
    "/v1/experiments/{experiment_id}",
    {
      params: {
        path: {
          experiment_id,
        },
      },
    }
  );
  invariant(experimentData, "Failed to get experiment");
  return {
    id: experimentData.id,
    datasetId: experimentData.dataset_id,
    datasetVersionId: experimentData.dataset_version_id,
    projectName: experimentData.project_name || "", // This will never happen
    metadata: experimentData.metadata,
  };
}
