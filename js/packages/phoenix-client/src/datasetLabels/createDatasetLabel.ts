import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { CreateDatasetLabelInput, DatasetLabel } from "./types";

export type CreateDatasetLabelParams = ClientFn & CreateDatasetLabelInput;

/**
 * Create a global dataset label resource.
 *
 * Label names are unique across Phoenix. A duplicate name is rejected with an
 * {@link HttpError} whose status is 409.
 *
 * @param params - The label fields and optional client.
 * @param params.name - Unique label name.
 * @param params.color - Lowercase hexadecimal display color.
 * @param params.description - Optional label description.
 * @param params.client - Optional Phoenix client instance.
 * @returns The created dataset label resource.
 */
export async function createDatasetLabel({
  client: _client,
  ...body
}: CreateDatasetLabelParams): Promise<DatasetLabel> {
  const client = _client ?? createClient();
  const { data, error } = await client.POST("/v1/dataset_labels", { body });

  if (error) throw error;
  if (!data?.data) throw new Error("Failed to create dataset label");
  return data.data;
}
