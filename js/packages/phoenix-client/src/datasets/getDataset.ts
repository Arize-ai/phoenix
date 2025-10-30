import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { Dataset, DatasetSelector } from "../types/datasets";

import { getDatasetExamples } from "./getDatasetExamples";
import { getDatasetInfo } from "./getDatasetInfo";

export type GetDatasetParams = ClientFn & {
  /** Dataset selector (ID or name) */
  dataset: DatasetSelector;
};

/**
 * Get dataset info and examples from the dataset
 * @param dataset - Dataset selector (ID or name)
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
