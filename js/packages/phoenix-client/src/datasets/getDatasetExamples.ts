import invariant from "tiny-invariant";
import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetSelector, DatasetExamples } from "../types/datasets";

export type GetDatasetExamplesParams = ClientFn & {
  dataset: DatasetSelector;
};

/**
 * Get the latest examples from a dataset
 */
export async function getDatasetExamples({
  client: _client,
  dataset,
}: GetDatasetExamplesParams): Promise<DatasetExamples> {
  const client = _client || createClient();
  const response = await client.GET("/v1/datasets/{id}/examples", {
    params: {
      path: {
        id: dataset.datasetId,
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
