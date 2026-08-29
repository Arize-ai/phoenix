import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { DatasetLabel } from "./types";

export interface GetDatasetLabelParams extends ClientFn {
  /** The global ID of the dataset label resource. */
  labelId: string;
}

/**
 * Get a global dataset label resource by ID.
 *
 * @param params - The label identifier and optional client.
 * @param params.labelId - The global ID of the dataset label resource.
 * @param params.client - Optional Phoenix client instance.
 * @returns The requested dataset label resource.
 */
export async function getDatasetLabel({
  client: _client,
  labelId,
}: GetDatasetLabelParams): Promise<DatasetLabel> {
  const client = _client ?? createClient();
  const { data, error } = await client.GET("/v1/dataset_labels/{label_id}", {
    params: { path: { label_id: labelId } },
  });

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to get dataset label");
  return data.data;
}
