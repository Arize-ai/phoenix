import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { CREATE_DATASET_SPLIT } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetIdentifier, DatasetSplit } from "../types/datasets";
import { ensureServerCapability } from "../utils/serverVersionUtils";
import { resolveDatasetIdentifier } from "./resolveDatasetIdentifier";

type CreateDatasetSplitRequestBody =
  components["schemas"]["CreateDatasetSplitRequestBody"];
type CreateDatasetSplitResponseBody =
  components["schemas"]["CreateDatasetSplitResponseBody"];

/** Parameters for creating a dataset split. */
export interface CreateDatasetSplitParams extends ClientFn {
  /** The dataset, selected by name or GlobalID. */
  dataset: DatasetIdentifier;
  /** A unique name for the split. */
  name: CreateDatasetSplitRequestBody["name"];
  /** An optional description of the split. */
  description?: CreateDatasetSplitRequestBody["description"];
  /** An optional hex color for the split. */
  color?: CreateDatasetSplitRequestBody["color"];
  /** Arbitrary JSON metadata for the split. */
  metadata?: CreateDatasetSplitRequestBody["metadata"];
  /** Dataset example GlobalIDs with which to seed the split. */
  exampleIds?: CreateDatasetSplitRequestBody["example_ids"];
}

/**
 * Create a split on an existing dataset.
 *
 * @param params - The split to create.
 * @param params.client - Optional Phoenix client instance.
 * @param params.dataset - The dataset, selected by name or GlobalID.
 * @param params.name - A unique name for the split.
 * @param params.description - An optional description of the split.
 * @param params.color - An optional hex color for the split.
 * @param params.metadata - Arbitrary JSON metadata for the split.
 * @param params.exampleIds - Dataset example GlobalIDs with which to seed the split.
 * @returns The created dataset split.
 * @throws {HttpError} If the dataset or an example does not exist, the name is
 * already in use, or the request is invalid.
 *
 * @requires Phoenix server >= 19.20.0
 */
export async function createDatasetSplit({
  client: _client,
  dataset,
  name,
  description,
  color,
  metadata,
  exampleIds,
}: CreateDatasetSplitParams): Promise<DatasetSplit> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: CREATE_DATASET_SPLIT });
  const datasetIdentifier = resolveDatasetIdentifier(dataset);

  const body: CreateDatasetSplitRequestBody = {
    name,
    ...(description !== undefined ? { description } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(exampleIds !== undefined ? { example_ids: exampleIds } : {}),
  };
  const response = await client.POST(
    "/v1/datasets/{dataset_identifier}/splits",
    {
      params: { path: { dataset_identifier: datasetIdentifier } },
      body,
    }
  );
  const responseBody: CreateDatasetSplitResponseBody | undefined =
    response.data;
  invariant(responseBody?.data, "Failed to create dataset split");
  return responseBody.data;
}
