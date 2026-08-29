import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { DatasetLabel, UpdateDatasetLabelInput } from "./types";

export type UpdateDatasetLabelParams = ClientFn &
  UpdateDatasetLabelInput & {
    /** The global ID of the dataset label resource. */
    labelId: string;
  };

/**
 * Partially update a global dataset label resource.
 *
 * Omitted fields remain unchanged. Pass `description: null` to clear the
 * description. At least one field must be provided.
 *
 * @param params - The label identifier, fields to change, and optional client.
 * @param params.labelId - The global ID of the dataset label resource.
 * @param params.name - New unique label name.
 * @param params.color - New lowercase hexadecimal display color.
 * @param params.description - New description, or null to clear it.
 * @param params.client - Optional Phoenix client instance.
 * @returns The updated dataset label resource.
 */
export async function updateDatasetLabel({
  client: _client,
  labelId,
  ...body
}: UpdateDatasetLabelParams): Promise<DatasetLabel> {
  const client = _client ?? createClient();
  const { data, error } = await client.PATCH("/v1/dataset_labels/{label_id}", {
    params: { path: { label_id: labelId } },
    body,
  });

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to update dataset label");
  return data.data;
}
