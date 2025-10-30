import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetExamples,DatasetSelector } from "../types/datasets";

import { getDatasetInfoByName } from "./getDatasetInfoByName";

import invariant from "tiny-invariant";

export type GetDatasetExamplesParams = ClientFn & {
  /** Dataset selector (ID, name, or version ID) */
  dataset: DatasetSelector;
};

/**
 * Get examples from a dataset
 * @param dataset - Dataset selector (ID, name, version ID, or splits)
 * @returns Dataset examples
 */
export async function getDatasetExamples({
  client: _client,
  dataset: datasetSelector,
}: GetDatasetExamplesParams): Promise<DatasetExamples> {
  const client = _client || createClient();

  let datasetId: string;

  if ("datasetName" in datasetSelector) {
    const datasetInfo = await getDatasetInfoByName({
      client,
      datasetName: datasetSelector.datasetName,
    });
    datasetId = datasetInfo.id;
  } else {
    datasetId = datasetSelector.datasetId;
  }

  const { versionId, splits } = datasetSelector;

  const response = await client.GET("/v1/datasets/{id}/examples", {
    params: {
      path: {
        id: datasetId,
      },
      query: {
        ...(versionId ? { version_id: versionId } : {}),
        ...(splits ? { split: splits } : {}),
      },
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
