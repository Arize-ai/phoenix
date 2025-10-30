import { createClient } from "../client";

import { createDataset, CreateDatasetParams } from "./createDataset";
import { getDatasetInfoByName } from "./getDatasetInfoByName";

export type CreateOrGetDatasetParams = CreateDatasetParams;

export type CreateOrGetDatasetResponse = {
  datasetId: string;
};

/**
 * Given the parameters to create a dataset, this function will either
 * retrieve an existing dataset by name or create a new one with the provided parameters.
 *
 * This is useful in cases where you would like to re-run a pipeline like:
 * - ensure dataset exists
 * - create a task
 * - run experiment
 * - evaluate experiment
 * without having to create a new dataset each time.
 */
export async function createOrGetDataset({
  name,
  description,
  examples,
  client: _client,
}: CreateOrGetDatasetParams): Promise<CreateOrGetDatasetResponse> {
  const client = _client || createClient();
  // start by fetching an existing dataset by name, catching any errors that occur
  try {
    const dataset = await getDatasetInfoByName({ datasetName: name, client });
    return {
      datasetId: dataset.id,
    };
  } catch {
    // If the dataset doesn't exist, create it, falling back to the error handling inside createDataset
    return await createDataset({ name, description, examples, client });
  }
}
