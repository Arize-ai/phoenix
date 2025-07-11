import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetInfo } from "../types/datasets";

export type GetDatasetParams = ClientFn & {
  datasetName: string;
};

/**
 * Get the information of a dataset via the name
 */
export async function getDatasetInfoByName({
  client: _client,
  datasetName,
}: GetDatasetParams): Promise<DatasetInfo> {
  const client = _client || createClient();
  const response = await client.GET("/v1/datasets", {
    params: {
      query: {
        name: datasetName,
      },
    },
  });
  if (response.data?.data?.length) {
    const datasetInfo = response.data.data[0];
    if (!datasetInfo) {
      throw new Error(`Dataset with name ${datasetName} not found`);
    }
    return {
      id: datasetInfo.id,
      name: datasetInfo.name,
      description: datasetInfo.description || undefined,
      metadata: datasetInfo.metadata,
    };
  }
  throw new Error(`Dataset with name ${datasetName} not found`);
}
