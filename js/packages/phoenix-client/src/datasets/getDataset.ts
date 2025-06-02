import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetSelector, Dataset } from "../types/datasets";
import { getDatasetExamples } from "./getDatasetExamples";
import { getDatasetInfo } from "./getDatasetInfo";

export type GetDatasetParams = ClientFn & {
  dataset: DatasetSelector;
};

/**
 * Get dataset info and the examples from the latest version of the dataset
 */
export async function getDataset({
  client: _client,
  dataset,
}: GetDatasetParams): Promise<Dataset> {
  const client = _client || createClient();
  const [datasetInfo, datasetExamples] = await Promise.all([
    getDatasetInfo({ client, dataset }),
    getDatasetExamples({ client, dataset }),
  ]);
  return {
    ...datasetInfo,
    ...datasetExamples,
  };
}
