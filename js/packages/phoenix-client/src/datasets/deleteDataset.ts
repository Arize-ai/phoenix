import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { ensureString } from "../utils/ensureString";

/**
 * Parameters to delete a dataset
 */
export interface DeleteDatasetParams extends ClientFn {
  /**
   * The ID of the dataset to delete
   */
  datasetId: string;
  /**
   * If true, also delete the projects associated with dataset evaluators.
   * Defaults to false.
   */
  deleteProjects?: boolean;
}

/**
 * Delete a dataset by ID.
 *
 * **Important**: This operation permanently deletes the dataset and all its associated
 * versions, examples, and experiments.
 *
 * Behavior:
 * - Deletes the dataset and all its data
 * - Returns successfully if dataset is found and deleted
 * - Throws error if dataset is not found (404) or other errors occur
 *
 * @param params - The parameters to delete a dataset
 * @returns Promise that resolves when the dataset is successfully deleted
 * @throws Error if the dataset is not found or deletion fails
 *
 * @example
 * ```ts
 * import { deleteDataset } from "@arizeai/phoenix-client/datasets";
 *
 * await deleteDataset({
 *   datasetId: "dataset_123",
 *   deleteProjects: true,
 * });
 * ```
 */
export async function deleteDataset({
  client: _client,
  datasetId,
  deleteProjects,
}: DeleteDatasetParams): Promise<void> {
  const client = _client ?? createClient();

  const { error } = await client.DELETE("/v1/datasets/{id}", {
    params: {
      path: {
        id: datasetId,
      },
      ...(deleteProjects !== undefined && {
        query: { delete_projects: deleteProjects },
      }),
    },
  });

  if (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404;
    if (isNotFound) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const errorMessage = ensureString(error);
    throw new Error(`Failed to delete dataset: ${errorMessage}`);
  }
}
