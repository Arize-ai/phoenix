import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { UPDATE_DATASET_SPLIT } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetIdentifier, DatasetSplit } from "../types/datasets";
import { ensureServerCapability } from "../utils/serverVersionUtils";
import { resolveDatasetIdentifier } from "./resolveDatasetIdentifier";

type UpdateDatasetSplitRequestBody =
  components["schemas"]["UpdateDatasetSplitRequestBody"];
type UpdateDatasetSplitResponseBody =
  components["schemas"]["UpdateDatasetSplitResponseBody"];

/** Parameters for partially updating a dataset split. */
export interface UpdateDatasetSplitParams extends ClientFn {
  /** The dataset, selected by name or GlobalID. */
  dataset: DatasetIdentifier;
  /** The dataset split GlobalID. */
  splitId: string;
  /** A new unique name for the split. */
  name?: UpdateDatasetSplitRequestBody["name"];
  /** A new description, or null to clear it. */
  description?: UpdateDatasetSplitRequestBody["description"];
  /** A new hex color for the split. */
  color?: UpdateDatasetSplitRequestBody["color"];
  /** JSON metadata that replaces the existing metadata. */
  metadata?: UpdateDatasetSplitRequestBody["metadata"];
  /** Dataset example GlobalIDs to add. Existing memberships are no-ops. */
  addExampleIds?: UpdateDatasetSplitRequestBody["add_example_ids"];
  /** Dataset example GlobalIDs to remove. Missing memberships are no-ops. */
  removeExampleIds?: UpdateDatasetSplitRequestBody["remove_example_ids"];
}

/**
 * Partially update a dataset split and/or its example membership.
 *
 * Only provided fields change. Membership additions and removals are
 * idempotent; if an example appears in both arrays, removal wins.
 *
 * @param params - The split fields and memberships to update.
 * @param params.client - Optional Phoenix client instance.
 * @param params.dataset - The dataset, selected by name or GlobalID.
 * @param params.splitId - The dataset split GlobalID.
 * @param params.name - A new unique name for the split.
 * @param params.description - A new description, or null to clear it.
 * @param params.color - A new hex color for the split.
 * @param params.metadata - JSON metadata that replaces the existing metadata.
 * @param params.addExampleIds - Dataset example GlobalIDs to add.
 * @param params.removeExampleIds - Dataset example GlobalIDs to remove.
 * @returns The updated dataset split.
 * @throws {HttpError} If the dataset, split, or an example does not exist, the
 * name is already in use, or the request is invalid.
 *
 * @requires Phoenix server >= 19.20.0
 */
export async function updateDatasetSplit({
  client: _client,
  dataset,
  splitId,
  name,
  description,
  color,
  metadata,
  addExampleIds,
  removeExampleIds,
}: UpdateDatasetSplitParams): Promise<DatasetSplit> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: UPDATE_DATASET_SPLIT });
  const datasetIdentifier = resolveDatasetIdentifier(dataset);

  const body: UpdateDatasetSplitRequestBody = {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(addExampleIds !== undefined ? { add_example_ids: addExampleIds } : {}),
    ...(removeExampleIds !== undefined
      ? { remove_example_ids: removeExampleIds }
      : {}),
  };
  const response = await client.PATCH(
    "/v1/datasets/{dataset_identifier}/splits/{split_id}",
    {
      params: {
        path: {
          dataset_identifier: datasetIdentifier,
          split_id: splitId,
        },
      },
      body,
    }
  );
  const responseBody: UpdateDatasetSplitResponseBody | undefined =
    response.data;
  invariant(responseBody?.data, "Failed to update dataset split");
  return responseBody.data;
}
