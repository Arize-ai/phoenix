import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { ensureString } from "../utils/ensureString";

/**
 * Parameters to delete an experiment
 */
export interface DeleteExperimentParams extends ClientFn {
  /**
   * The ID of the experiment to delete
   */
  experimentId: string;
}

/**
 * Delete an experiment by ID.
 *
 * **Important**: This operation permanently deletes the experiment and all its associated
 * runs, evaluations, and annotations.
 *
 * Behavior:
 * - Deletes the experiment and all its data
 * - Returns successfully if experiment is found and deleted
 * - Throws error if experiment is not found (404) or other errors occur
 *
 * @param params - The parameters to delete an experiment
 * @returns Promise that resolves when the experiment is successfully deleted
 * @throws Error if the experiment is not found or deletion fails
 *
 * @example
 * ```ts
 * import { deleteExperiment } from "@arizeai/phoenix-client/experiments";
 *
 * await deleteExperiment({
 *   experimentId: "exp_123",
 * });
 * ```
 */
export async function deleteExperiment({
  client: _client,
  experimentId,
}: DeleteExperimentParams): Promise<void> {
  const client = _client ?? createClient();

  const { error } = await client.DELETE("/v1/experiments/{experiment_id}", {
    params: {
      path: {
        experiment_id: experimentId,
      },
    },
  });

  if (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404;
    if (isNotFound) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    // Extract meaningful error information
    const errorMessage = ensureString(error);
    throw new Error(`Failed to delete experiment: ${errorMessage}`);
  }
}
