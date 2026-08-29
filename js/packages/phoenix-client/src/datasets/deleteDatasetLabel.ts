import { createClient } from "../client";
import type { ClientFn } from "../types/core";

export interface DeleteDatasetLabelParams extends ClientFn {
  /** The global ID of the dataset label resource. */
  labelId: string;
}

/**
 * Delete a global dataset label resource.
 *
 * Deleting the resource also removes all of its dataset assignments.
 *
 * @param params - The label identifier and optional client.
 * @param params.labelId - The global ID of the dataset label resource.
 * @param params.client - Optional Phoenix client instance.
 */
export async function deleteDatasetLabel({
  client: _client,
  labelId,
}: DeleteDatasetLabelParams): Promise<void> {
  const client = _client ?? createClient();
  const { error } = await client.DELETE("/v1/dataset_labels/{label_id}", {
    params: { path: { label_id: labelId } },
  });

  if (error) throw error;
}
