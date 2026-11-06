import { createClient } from "../client";
import { DELETE_DATASET_SPLIT } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetIdentifier } from "../types/datasets";
import { ensureServerCapability } from "../utils/serverVersionUtils";
import { resolveDatasetIdentifier } from "./resolveDatasetIdentifier";

/** Parameters for deleting a dataset split. */
export interface DeleteDatasetSplitParams extends ClientFn {
  /** The dataset, selected by name or GlobalID. */
  dataset: DatasetIdentifier;
  /** The dataset split GlobalID. */
  splitId: string;
}

/**
 * Delete a dataset split and its memberships without deleting its examples.
 *
 * @param params - The split to delete.
 * @param params.client - Optional Phoenix client instance.
 * @param params.dataset - The dataset, selected by name or GlobalID.
 * @param params.splitId - The dataset split GlobalID.
 * @returns A promise that resolves once the split is deleted.
 * @throws {HttpError} If the dataset or split does not exist, or the split ID
 * is invalid.
 *
 * @requires Phoenix server >= 19.20.0
 */
export async function deleteDatasetSplit({
  client: _client,
  dataset,
  splitId,
}: DeleteDatasetSplitParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: DELETE_DATASET_SPLIT });
  const datasetIdentifier = resolveDatasetIdentifier(dataset);

  await client.DELETE("/v1/datasets/{dataset_identifier}/splits/{split_id}", {
    params: {
      path: {
        dataset_identifier: datasetIdentifier,
        split_id: splitId,
      },
    },
  });
}
