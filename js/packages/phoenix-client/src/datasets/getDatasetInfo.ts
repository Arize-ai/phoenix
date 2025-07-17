import invariant from "tiny-invariant";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetSelector, DatasetInfo } from "../types/datasets";
import { getDatasetInfoByName } from "./getDatasetInfoByName";

export type GetDatasetInfoParams = ClientFn & {
  dataset: DatasetSelector;
};

/**
 * Get an overview of the information in a dataset
 * Note: this does not include the examples contained in the dataset
 */
export async function getDatasetInfo({
  client: _client,
  dataset,
}: GetDatasetInfoParams): Promise<DatasetInfo> {
  const client = _client || createClient();
  if ("datasetName" in dataset) {
    return await getDatasetInfoByName({
      client,
      datasetName: dataset.datasetName,
    });
  }

  const datasetResponse = await client.GET("/v1/datasets/{id}", {
    params: {
      path: {
        id: dataset.datasetId,
      },
    },
  });
  invariant(datasetResponse.data?.data, "Failed to get dataset info");
  const datasetInfo = datasetResponse.data.data;
  return {
    id: datasetInfo.id,
    name: datasetInfo.name,
    description: datasetInfo.description || undefined,
    metadata: datasetInfo.metadata,
  };
}
