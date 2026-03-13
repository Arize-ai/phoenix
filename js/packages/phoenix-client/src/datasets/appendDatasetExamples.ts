import invariant from "tiny-invariant";

import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { DatasetSelector, Example } from "../types/datasets";
import { getDatasetInfo } from "./getDatasetInfo";

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
  versionId: string;
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
 *   - `externalId`: Optional external ID for the example
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
  const inputs: Record<string, unknown>[] = [];
  const outputs: Record<string, unknown>[] = [];
  const metadata: Record<string, unknown>[] = [];
  const splits: (string | string[] | null)[] = [];
  const spanIds: (string | null)[] = [];
  const externalIds: (string | null)[] = [];
  let hasSpanIds = false;
  let hasExternalIds = false;

  for (const example of examples) {
    inputs.push(example.input);
    outputs.push(example.output ?? {}); // Treat null as an empty object
    metadata.push(example.metadata ?? {});
    splits.push(example.splits !== undefined ? example.splits : null);
    const spanId = example.spanId ?? null;
    spanIds.push(spanId);
    if (spanId !== null) hasSpanIds = true;
    const externalId = example.externalId ?? null;
    externalIds.push(externalId);
    if (externalId !== null) hasExternalIds = true;
  }

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
      ...(hasExternalIds ? { external_ids: externalIds } : {}),
    },
  });
  invariant(appendResponse.data?.data, "Failed to append dataset examples");
  const datasetId = appendResponse.data.data.dataset_id;
  const versionId = appendResponse.data.data.version_id;
  return {
    datasetId,
    versionId,
  };
}
