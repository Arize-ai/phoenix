import invariant from "tiny-invariant";

import { createClient } from "../client";
import { PATCH_DATASET_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  DatasetEvaluator,
  DatasetEvaluatorPatch,
} from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for updating a dataset evaluator binding.
 */
export interface UpdateDatasetEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the binding.
   */
  datasetEvaluatorId: string;
  /**
   * The fields to change. At least one must be present; omitted fields keep
   * their current values. Set `description` or `output_configs` to `null` to
   * inherit the shared definition's value again; an `output_configs` override
   * holds at least one config.
   */
  patch: DatasetEvaluatorPatch;
}

/**
 * Update a dataset evaluator binding.
 *
 * @param params - The binding and the fields to change.
 * @param params.datasetEvaluatorId - The binding GlobalID.
 * @param params.patch - The fields to change.
 * @param params.client - An optional Phoenix client instance.
 * @returns The updated binding.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { updateDatasetEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * await updateDatasetEvaluator({
 *   datasetEvaluatorId: "RGF0YXNldEV2YWx1YXRvcjox",
 *   patch: { description: "Runs against the nightly golden set" },
 * });
 * ```
 */
export async function updateDatasetEvaluator({
  client: _client,
  datasetEvaluatorId,
  patch,
}: UpdateDatasetEvaluatorParams): Promise<DatasetEvaluator> {
  if (Object.keys(patch).length === 0) {
    throw new Error("At least one field to update must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: PATCH_DATASET_EVALUATOR,
  });

  const { data, error } = await client.PATCH(
    "/v1/dataset_evaluators/{dataset_evaluator_id}",
    {
      params: { path: { dataset_evaluator_id: datasetEvaluatorId } },
      body: patch,
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to update dataset evaluator");
  return data.data;
}
