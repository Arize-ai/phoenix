import invariant from "tiny-invariant";
import { PhoenixClient } from "../client";
import { Example } from "../types/datasets";

import { Dataset } from "../types/datasets";

/**
 * Parameters for the getDatasetLike function
 */
export type GetDatasetLikeParams = {
  /**
   * The dataset to get. Can be in the form of a dataset id, an array of examples, or a dataset object.
   */
  dataset: Dataset | string | Example[];
  client: PhoenixClient;
};

/**
 * Return a dataset object from the input.
 *
 * If the input is a string, assume it is a dataset id and fetch the dataset from the client.
 * If the input is an array of examples, create a new dataset from the examples then return it.
 * If the input is a dataset, return it as is.
 *
 * @param params - The parameters to get a dataset.
 * @returns The dataset.
 */
export async function getDatasetBySelector({
  dataset,
  client,
}: GetDatasetLikeParams): Promise<Dataset | null> {
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
    // Create a dataset from the examples
    if (dataset.length === 0) {
      return null;
    }

    // Extract inputs, outputs, and metadata from examples
    const inputs = dataset.map(example => example.input || {});
    const outputs = dataset.map(example => example.output || {});
    const metadata = dataset.map(example => example.metadata || {});

    // Create a unique dataset name
    const datasetName = `dataset-${Date.now()}`;
    
    // Create the dataset via the API
    const datasetResponse = await client.POST("/v1/datasets/upload", {
      params: {
        query: {
          sync: true // Wait for the dataset to be created
        }
      },
      body: {
        name: datasetName,
        description: "Dataset created from examples",
        action: "create",
        inputs,
        outputs,
        metadata
      }
    });

    const responseData = datasetResponse.data?.data;
    invariant(responseData, "Failed to create dataset from examples");
    
    // Get the full dataset with examples
    const datasetId = responseData.dataset_id;
    return await getDatasetBySelector({ dataset: datasetId, client });
  }
  return dataset;
}
