import invariant from "tiny-invariant";

import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { Example } from "../types/datasets";

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
  versionId: string;
};

/**
 * Create a new dataset with examples.
 *
 * Uses upsert semantics: if the dataset does not exist it will be created; if
 * it already exists, the dataset will be updated to reflect the state.
 *
 * @experimental this interface may change in the future
 *
 * @param params - The parameters for creating the dataset
 * @param params.client - Optional Phoenix client instance
 * @param params.name - The name of the dataset
 * @param params.description - The description of the dataset
 * @param params.examples - The examples to create in the dataset. Each example can include:
 *   - `id`: Optional stable ID for the example, used to reference or update it later
 *   - `input`: Required input data for the example
 *   - `output`: Optional expected output data
 *   - `metadata`: Optional metadata for the example
 *   - `splits`: Optional split assignment (string, array of strings, or null)
 *   - `spanId`: Optional OpenTelemetry span ID to link the example back to its source span
 *
 * @returns A promise that resolves to the dataset ID and version ID
 *
 * @example
 * ```ts
 * const { datasetId, versionId } = await createDataset({
 *   name: "qa-dataset",
 *   description: "Q&A examples",
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
 *     },
 *     {
 *       id: "my-stable-id", // Stable ID for referencing this example later
 *       input: { question: "What is a neural network?" },
 *       output: { answer: "A neural network is..." },
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
  const inputs: Record<string, unknown>[] = [];
  const outputs: Record<string, unknown>[] = [];
  const metadata: Record<string, unknown>[] = [];
  const splits: (string | string[] | null)[] = [];
  const spanIds: (string | null)[] = [];
  const exampleIds: (string | null)[] = [];
  let hasSpanIds = false;
  let hasExampleIds = false;

  for (const example of examples) {
    inputs.push(example.input);
    outputs.push(example.output ?? {}); // Treat null as an empty object
    metadata.push(example.metadata ?? {});
    splits.push(example.splits !== undefined ? example.splits : null);
    const spanId = example.spanId ?? null;
    spanIds.push(spanId);
    if (spanId !== null) hasSpanIds = true;
    const exampleId = example.id ?? null;
    exampleIds.push(exampleId);
    if (exampleId !== null) hasExampleIds = true;
  }

  const createDatasetResponse = await client.POST("/v1/datasets/upload", {
    params: {
      query: {
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
      ...(hasExampleIds ? { example_ids: exampleIds } : {}),
    },
  });
  invariant(createDatasetResponse.data?.data, "Failed to create dataset");
  const datasetId = createDatasetResponse.data.data.dataset_id;
  const versionId = createDatasetResponse.data.data.version_id;
  return {
    datasetId,
    versionId,
  };
}
