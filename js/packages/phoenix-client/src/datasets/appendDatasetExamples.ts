import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { DatasetSelector, Example } from "../types/datasets";

import { getDatasetInfo } from "./getDatasetInfo";

import invariant from "tiny-invariant";

export type AppendDatasetExamplesParams = ClientFn & {
  /**
   * The dataset to append examples to
   */
  dataset: DatasetSelector;
  /**
   * The examples to append to the dataset
   */
  examples: Example[];
};

export type AppendDatasetExamplesResponse = {
  datasetId: string;
  // TODO: respond with the versionId
  // versionId: string;
};

/**
 * Append examples to an existing dataset.
 *
 * @experimental this interface may change in the future
 *
 * @param params - The parameters for appending examples
 * @param params.client - Optional Phoenix client instance
 * @param params.dataset - The dataset to append examples to (by ID or name)
 * @param params.examples - The examples to append. Each example can include:
 *   - `input`: Required input data for the example
 *   - `output`: Optional expected output data
 *   - `metadata`: Optional metadata for the example
 *   - `splits`: Optional split assignment (string, array of strings, or null)
 *   - `spanId`: Optional OpenTelemetry span ID to link the example back to its source span
 *
 * @returns A promise that resolves to the dataset ID
 *
 * @example
 * ```ts
 * // Append examples with span links to an existing dataset
 * const { datasetId } = await appendDatasetExamples({
 *   dataset: { datasetName: "qa-dataset" },
 *   examples: [
 *     {
 *       input: { question: "What is deep learning?" },
 *       output: { answer: "Deep learning is..." },
 *       spanId: "span123abc" // Links to the source span
 *     }
 *   ]
 * });
 * ```
 */
export async function appendDatasetExamples({
  client: _client,
  dataset,
  examples,
}: AppendDatasetExamplesParams): Promise<AppendDatasetExamplesResponse> {
  const client = _client || createClient();
  const inputs = examples.map((example) => example.input);
  const outputs = examples.map((example) => example.output ?? {}); // Treat null as an empty object
  const metadata = examples.map((example) => example.metadata ?? {});
  const splits = examples.map((example) =>
    example.splits !== undefined ? example.splits : null
  );

  // Extract span IDs from examples, preserving null/undefined as null
  const spanIds = examples.map((example) => example?.spanId ?? null);

  // Only include span_ids in the request if at least one example has a span ID
  const hasSpanIds = spanIds.some((id) => id !== null);

  let datasetName: string;
  if ("datasetName" in dataset) {
    datasetName = dataset.datasetName;
  } else {
    const datasetInfo = await getDatasetInfo({
      client,
      dataset,
    });
    datasetName = datasetInfo.name;
  }
  const appendResponse = await client.POST("/v1/datasets/upload", {
    params: {
      query: {
        sync: true,
      },
    },
    body: {
      name: datasetName,
      action: "append",
      inputs,
      outputs,
      metadata,
      splits,
      ...(hasSpanIds ? { span_ids: spanIds } : {}),
    },
  });
  invariant(appendResponse.data?.data, "Failed to append dataset examples");
  const datasetId = appendResponse.data.data.dataset_id;
  return {
    datasetId,
  };
}
