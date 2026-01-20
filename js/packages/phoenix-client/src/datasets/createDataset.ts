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
 * Create a new dataset with examples.
 *
 * @experimental this interface may change in the future
 *
 * @param params - The parameters for creating the dataset
 * @param params.client - Optional Phoenix client instance
 * @param params.name - The name of the dataset
 * @param params.description - The description of the dataset
 * @param params.examples - The examples to create in the dataset. Each example can include:
 *   - `input`: Required input data for the example
 *   - `output`: Optional expected output data
 *   - `metadata`: Optional metadata for the example
 *   - `splits`: Optional split assignment (string, array of strings, or null)
 *   - `spanId`: Optional OpenTelemetry span ID to link the example back to its source span
 *
 * @returns A promise that resolves to the created dataset ID
 *
 * @example
 * ```ts
 * // Create a dataset with span links
 * const { datasetId } = await createDataset({
 *   name: "qa-dataset",
 *   description: "Q&A examples from traces",
 *   examples: [
 *     {
 *       input: { question: "What is AI?" },
 *       output: { answer: "Artificial Intelligence is..." },
 *       spanId: "abc123def456" // Links to the source span
 *     },
 *     {
 *       input: { question: "Explain ML" },
 *       output: { answer: "Machine Learning is..." },
 *       spanId: "789ghi012jkl"
 *     }
 *   ]
 * });
 * ```
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
  const splits = examples.map((example) =>
    example?.splits !== undefined ? example.splits : null
  );

  // Extract span IDs from examples, preserving null/undefined as null
  const spanIds = examples.map((example) => example?.spanId ?? null);

  // Only include span_ids in the request if at least one example has a span ID
  const hasSpanIds = spanIds.some((id) => id !== null);

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
      ...(hasSpanIds ? { span_ids: spanIds } : {}),
    },
  });
  invariant(createDatasetResponse.data?.data, "Failed to create dataset");
  const datasetId = createDatasetResponse.data.data.dataset_id;
  return {
    datasetId,
  };
}
