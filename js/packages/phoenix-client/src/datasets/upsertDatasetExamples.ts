import invariant from "tiny-invariant";

import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { DatasetSelector, Example } from "../types/datasets";
import { getDatasetInfo } from "./getDatasetInfo";

export type UpsertDatasetExamplesParams = ClientFn & {
  /**
   * The dataset to upsert examples into
   */
  dataset: DatasetSelector;
  /**
   * Optional description (used when creating a new dataset)
   */
  description?: string;
  /**
   * The examples to upsert into the dataset
   */
  examples: Example[];
};

export type UpsertDatasetExamplesResponse = {
  datasetId: string;
  versionId: string;
};

/**
 * Create or update a dataset using upsert semantics.
 *
 * If the dataset does not exist it will be created. If it already exists,
 * examples are merged with the previous version: examples matching by
 * `externalId` (or by content hash when no `externalId` is given) are updated
 * if their content changed; examples absent from the batch are deleted; and
 * new examples are added.
 *
 * @experimental this interface may change in the future
 *
 * @param params - The parameters for upserting examples
 * @param params.client - Optional Phoenix client instance
 * @param params.dataset - The dataset to upsert into (by ID or name)
 * @param params.description - Optional description (used when creating a new dataset)
 * @param params.examples - The examples to upsert. Each example can include:
 *   - `input`: Required input data for the example
 *   - `output`: Optional expected output data
 *   - `metadata`: Optional metadata for the example
 *   - `splits`: Optional split assignment (string, array of strings, or null)
 *   - `spanId`: Optional OpenTelemetry span ID to link the example back to its source span
 *   - `externalId`: Optional external ID for deduplication during upsert
 *
 * @returns A promise that resolves to the dataset ID and version ID
 *
 * @example
 * ```ts
 * // Upsert examples with external IDs for deduplication
 * const { datasetId, versionId } = await upsertDatasetExamples({
 *   dataset: { datasetName: "qa-dataset" },
 *   examples: [
 *     {
 *       input: { question: "What is deep learning?" },
 *       output: { answer: "Deep learning is..." },
 *       externalId: "dl-question-1",
 *     }
 *   ]
 * });
 * ```
 */
export async function upsertDatasetExamples({
  client: _client,
  dataset,
  description,
  examples,
}: UpsertDatasetExamplesParams): Promise<UpsertDatasetExamplesResponse> {
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
  const upsertResponse = await client.POST("/v1/datasets/upload", {
    params: {
      query: {
        sync: true,
      },
    },
    body: {
      name: datasetName,
      action: "upsert",
      inputs,
      outputs,
      metadata,
      splits,
      ...(description ? { description } : {}),
      ...(hasSpanIds ? { span_ids: spanIds } : {}),
      ...(hasExternalIds ? { external_ids: externalIds } : {}),
    },
  });
  invariant(upsertResponse.data?.data, "Failed to upsert dataset examples");
  const datasetId = upsertResponse.data.data.dataset_id;
  const versionId = upsertResponse.data.data.version_id;
  return {
    datasetId,
    versionId,
  };
}
