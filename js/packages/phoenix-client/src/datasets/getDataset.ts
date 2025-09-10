import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetSelector, Dataset } from "../types/datasets";
import { getDatasetExamples } from "./getDatasetExamples";
import { getDatasetInfo } from "./getDatasetInfo";

export type GetDatasetParams = ClientFn & {
  dataset: DatasetSelector;
  versionId?: string;
};

/**
 * Get dataset info and examples from the dataset
 * @param dataset - Dataset selector (ID or name)
 * @param versionId - Optional specific version ID (if omitted, returns data from the latest version)
 */
export async function getDataset({
  client: _client,
  dataset,
  versionId,
}: GetDatasetParams): Promise<Dataset> {
  const client = _client || createClient();
  const [datasetInfo, datasetExamples] = await Promise.all([
    getDatasetInfo({ client, dataset }),
    getDatasetExamples({ client, dataset, versionId }),
  ]);
  return {
    ...datasetInfo,
    ...datasetExamples,
  };
}
