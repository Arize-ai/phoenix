import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { Example } from "../types/datasets";

import invariant from "tiny-invariant";

export type CreateDatasetParams = ClientFn & {
  /**
   * The name of the dataset
   */
  name: string;
  /**
   * The description of the dataset
   */
  description: string;
  /**
   * The examples to create in the dataset
   */
  examples: Example[];
};

export type CreateDatasetResponse = {
  datasetId: string;
};

/**
 * Create a new dataset
 * @experimental this interface may change in the future
 */
export async function createDataset({
  client: _client,
  name,
  description,
  examples,
}: CreateDatasetParams): Promise<CreateDatasetResponse> {
  const client = _client || createClient();
  const inputs = examples.map((example) => example.input);
  const outputs = examples.map((example) => example?.output ?? {}); // Treat null as an empty object
  const metadata = examples.map((example) => example?.metadata ?? {});
  const splits = examples.map((example) => example?.splits ?? {});
  const createDatasetResponse = await client.POST("/v1/datasets/upload", {
    params: {
      query: {
        // TODO: parameterize this
        sync: true,
      },
    },
    body: {
      name,
      description,
      action: "create",
      inputs,
      outputs,
      metadata,
      splits,
    },
  });
  invariant(createDatasetResponse.data?.data, "Failed to create dataset");
  const datasetId = createDatasetResponse.data.data.dataset_id;
  return {
    datasetId,
  };
}
