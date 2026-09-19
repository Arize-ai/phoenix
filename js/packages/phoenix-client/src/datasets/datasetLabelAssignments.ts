import invariant from "tiny-invariant";

import { createClient } from "../client";
import {
  ADD_DATASET_LABEL,
  LIST_DATASET_LABELS,
  REMOVE_DATASET_LABEL,
  REPLACE_DATASET_LABELS,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetSelector } from "../types/datasets";
import { ensureServerCapability } from "../utils/serverVersionUtils";
import type { DatasetLabel } from "./datasetLabelTypes";

export interface ListLabelsForDatasetParams extends ClientFn {
  /** The dataset to list labels for, selected by name or GlobalID. */
  dataset: DatasetSelector;
}

export interface AddLabelToDatasetParams extends ClientFn {
  /** The dataset to apply the label to, selected by name or GlobalID. */
  dataset: DatasetSelector;
  /** The GlobalID of the dataset label to apply. */
  labelId: string;
}

export interface RemoveLabelFromDatasetParams extends ClientFn {
  /** The dataset to remove the label from, selected by name or GlobalID. */
  dataset: DatasetSelector;
  /** The GlobalID of the dataset label to remove. */
  labelId: string;
}

export interface ReplaceLabelsForDatasetParams extends ClientFn {
  /** The dataset whose labels should be replaced, selected by name or GlobalID. */
  dataset: DatasetSelector;
  /** The complete set of dataset label GlobalIDs to apply. */
  labelIds: string[];
}

/**
 * List the labels applied to a dataset.
 *
 * @param params - The parameters for listing a dataset's labels
 * @param params.client - Optional Phoenix client instance
 * @param params.dataset - The dataset to list labels for, selected by name or GlobalID
 * @returns The labels currently applied to the dataset
 *
 * @requires Phoenix server >= 17.16.0
 */
export async function listLabelsForDataset({
  client: _client,
  dataset,
}: ListLabelsForDatasetParams): Promise<DatasetLabel[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: LIST_DATASET_LABELS });
  const response = await client.GET(
    "/v1/datasets/{dataset_identifier}/labels",
    {
      params: {
        path: {
          dataset_identifier: getDatasetIdentifier(dataset),
        },
      },
    }
  );

  if (response.error) throw response.error;
  invariant(response.data?.data, "Failed to list dataset labels");
  return response.data.data;
}

/**
 * Apply an existing label to a dataset.
 *
 * Applying a label that is already assigned is an idempotent no-op.
 *
 * @param params - The parameters for applying a dataset label
 * @param params.client - Optional Phoenix client instance
 * @param params.dataset - The dataset to apply the label to, selected by name or GlobalID
 * @param params.labelId - The GlobalID of the dataset label to apply
 * @returns The applied dataset label
 *
 * @requires Phoenix server >= 17.16.0
 */
export async function addLabelToDataset({
  client: _client,
  dataset,
  labelId,
}: AddLabelToDatasetParams): Promise<DatasetLabel> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: ADD_DATASET_LABEL });
  const response = await client.PUT(
    "/v1/datasets/{dataset_identifier}/labels/{label_id}",
    {
      params: {
        path: {
          dataset_identifier: getDatasetIdentifier(dataset),
          label_id: labelId,
        },
      },
    }
  );

  if (response.error) throw response.error;
  invariant(response.data?.data, "Failed to add dataset label");
  return response.data.data;
}

/**
 * Remove a label from a dataset without deleting the label itself.
 *
 * Removing a label that is not assigned is an idempotent no-op.
 *
 * @param params - The parameters for removing a dataset label
 * @param params.client - Optional Phoenix client instance
 * @param params.dataset - The dataset to remove the label from, selected by name or GlobalID
 * @param params.labelId - The GlobalID of the dataset label to remove
 *
 * @requires Phoenix server >= 17.16.0
 */
export async function removeLabelFromDataset({
  client: _client,
  dataset,
  labelId,
}: RemoveLabelFromDatasetParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: REMOVE_DATASET_LABEL });
  const response = await client.DELETE(
    "/v1/datasets/{dataset_identifier}/labels/{label_id}",
    {
      params: {
        path: {
          dataset_identifier: getDatasetIdentifier(dataset),
          label_id: labelId,
        },
      },
    }
  );

  if (response.error) throw response.error;
}

/**
 * Replace all labels applied to a dataset.
 *
 * Pass an empty `labelIds` array to remove every label from the dataset.
 * Duplicate label IDs are accepted and de-duplicated by the server.
 *
 * @param params - The parameters for replacing a dataset's labels
 * @param params.client - Optional Phoenix client instance
 * @param params.dataset - The dataset whose labels should be replaced, selected by name or GlobalID
 * @param params.labelIds - The complete set of dataset label GlobalIDs to apply
 * @returns The replacement set of dataset labels
 *
 * @requires Phoenix server >= 17.16.0
 */
export async function replaceLabelsForDataset({
  client: _client,
  dataset,
  labelIds,
}: ReplaceLabelsForDatasetParams): Promise<DatasetLabel[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: REPLACE_DATASET_LABELS });
  const response = await client.PUT(
    "/v1/datasets/{dataset_identifier}/labels",
    {
      params: {
        path: {
          dataset_identifier: getDatasetIdentifier(dataset),
        },
      },
      body: {
        dataset_label_ids: labelIds,
      },
    }
  );

  if (response.error) throw response.error;
  invariant(response.data?.data, "Failed to replace dataset labels");
  return response.data.data;
}

function getDatasetIdentifier(dataset: DatasetSelector): string {
  return "datasetName" in dataset ? dataset.datasetName : dataset.datasetId;
}
