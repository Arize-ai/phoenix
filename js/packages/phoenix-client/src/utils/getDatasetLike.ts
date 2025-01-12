import invariant from "tiny-invariant";
import { PhoenixClient } from "../client";
import { Example } from "../types/datasets";

import { Dataset } from "../types/datasets";

/**
 * Return a dataset object from the input.
 *
 * If the input is a string, assume it is a dataset id and fetch the dataset from the client.
 * If the input is an array of examples, create a new dataset from the examples then return it.
 * If the input is a dataset, return it as is.
 *
 * @param dataset - The dataset to get.
 * @returns The dataset.
 */
export async function getDatasetLike({
  dataset,
  client,
}: {
  dataset: Dataset | string | Example[];
  client: PhoenixClient;
}): Promise<Dataset> {
  if (typeof dataset === "string") {
    const datasetResponse = await client
      .GET(`/v1/datasets/{id}`, { params: { path: { id: dataset } } })
      .then((d) => d.data?.data);
    invariant(datasetResponse, `Dataset ${dataset} not found`);
    const examples = await client
      .GET(`/v1/datasets/{id}/examples`, { params: { path: { id: dataset } } })
      .then((e) => e.data?.data);
    invariant(examples, `Examples for dataset ${dataset} not found`);
    const datasetWithExamples: Dataset = {
      ...datasetResponse,
      examples: examples.examples.map((example) => ({
        ...example,
        updatedAt: new Date(example.updated_at),
      })),
      versionId: examples.version_id,
    };
    return datasetWithExamples;
  }
  if (Array.isArray(dataset)) {
    throw new Error("TODO: implement dataset creation from examples");
  }
  return dataset;
}
