import invariant from "tiny-invariant";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetSelector, DatasetExamples } from "../types/datasets";
import { getDatasetInfoByName } from "./getDatasetInfoByName";

export type GetDatasetExamplesParams = ClientFn & {
  dataset: DatasetSelector;
  versionId?: string;
};

/**
 * Get examples from a dataset
 * @param dataset - Dataset selector (ID, name, or version ID)
 * @param versionId - Optional specific version ID (ignored if dataset selector is datasetVersionId)
 */
export async function getDatasetExamples({
  client: _client,
  dataset,
  versionId,
}: GetDatasetExamplesParams): Promise<DatasetExamples> {
  const client = _client || createClient();

  let datasetId: string;

  if ("datasetName" in dataset) {
    const datasetInfo = await getDatasetInfoByName({
      client,
      datasetName: dataset.datasetName,
    });
    datasetId = datasetInfo.id;
  } else {
    datasetId = dataset.datasetId;
  }

  const response = await client.GET("/v1/datasets/{id}/examples", {
    params: {
      path: {
        id: datasetId,
      },
      query: versionId
        ? {
            version_id: versionId,
          }
        : undefined,
    },
  });

  invariant(response.data?.data, "Failed to get dataset examples");
  const examplesData = response.data.data;
  return {
    versionId: examplesData.version_id,
    examples: examplesData.examples.map((example) => ({
      ...example,
      updatedAt: new Date(example.updated_at),
    })),
  };
}
