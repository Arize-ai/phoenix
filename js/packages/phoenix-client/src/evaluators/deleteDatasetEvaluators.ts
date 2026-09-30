import { createClient } from "../client";
import {
  DELETE_DATASET_EVALUATOR,
  DELETE_DATASET_EVALUATORS,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { DatasetIdentifier } from "../types/evaluators";
import { resolveDatasetIdentifier } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting one dataset evaluator binding.
 */
export interface DeleteDatasetEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the binding.
   */
  datasetEvaluatorId: string;
}

/**
 * Delete a dataset evaluator binding; a missing binding is ignored.
 *
 * The evaluator definition, its prompt, and the binding's trace project are
 * kept. Delete a definition that nothing binds with `deleteEvaluator`.
 *
 * @param params - The binding to delete.
 * @param params.datasetEvaluatorId - The binding GlobalID.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteDatasetEvaluator({
  client: _client,
  datasetEvaluatorId,
}: DeleteDatasetEvaluatorParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_DATASET_EVALUATOR,
  });

  const { error } = await client.DELETE(
    "/v1/dataset_evaluators/{dataset_evaluator_id}",
    { params: { path: { dataset_evaluator_id: datasetEvaluatorId } } }
  );

  if (error) throw error;
}

/**
 * Parameters for deleting several of a dataset's evaluator bindings at once.
 */
export interface DeleteDatasetEvaluatorsParams extends ClientFn {
  /**
   * The dataset the bindings belong to, by ID or name.
   */
  dataset: DatasetIdentifier;
  /**
   * The GlobalIDs of the bindings, at most 1000.
   */
  datasetEvaluatorIds: string[];
}

/**
 * Delete several of a dataset's evaluator bindings atomically.
 *
 * Either every binding is deleted or none is. Missing bindings are ignored; an
 * ID that is not a binding, or a binding of another dataset, fails the whole
 * request. Definitions, prompts, and trace projects are kept.
 *
 * @param params - The dataset and the bindings to delete.
 * @param params.dataset - The dataset, by `dataset` (name or ID), `datasetId`, or `datasetName`.
 * @param params.datasetEvaluatorIds - The binding GlobalIDs.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteDatasetEvaluators({
  client: _client,
  dataset,
  datasetEvaluatorIds,
}: DeleteDatasetEvaluatorsParams): Promise<void> {
  if (datasetEvaluatorIds.length === 0) {
    throw new Error("At least one datasetEvaluatorId must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_DATASET_EVALUATORS,
  });

  const { error } = await client.DELETE(
    "/v1/datasets/{dataset_identifier}/evaluators",
    {
      params: {
        path: { dataset_identifier: resolveDatasetIdentifier(dataset) },
        query: { dataset_evaluator_id: datasetEvaluatorIds },
      },
    }
  );

  if (error) throw error;
}
