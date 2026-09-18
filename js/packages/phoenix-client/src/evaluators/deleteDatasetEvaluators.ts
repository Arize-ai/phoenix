import { createClient } from "../client";
import {
  DELETE_DATASET_EVALUATOR,
  DELETE_DATASET_EVALUATORS,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

interface DeleteBindingOptions {
  /**
   * Also delete the prompt of an LLM evaluator that is deleted along with the
   * binding. Off by default so that a prompt adopted from the prompt hub
   * survives the binding.
   * @default false
   */
  deleteAssociatedPrompt?: boolean;
}

/**
 * Parameters for deleting one dataset evaluator binding.
 */
export interface DeleteDatasetEvaluatorParams
  extends ClientFn, DeleteBindingOptions {
  /**
   * The GlobalID of the binding.
   */
  datasetEvaluatorId: string;
}

/**
 * Delete a dataset evaluator binding and its evaluator traces.
 *
 * The shared definition is deleted once nothing else references it. A missing
 * binding is ignored.
 *
 * @param params - The binding to delete.
 * @param params.datasetEvaluatorId - The binding GlobalID.
 * @param params.deleteAssociatedPrompt - Also delete the LLM prompt. Defaults to `false`.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteDatasetEvaluator({
  client: _client,
  datasetEvaluatorId,
  deleteAssociatedPrompt,
}: DeleteDatasetEvaluatorParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_DATASET_EVALUATOR,
  });

  const { error } = await client.DELETE(
    "/v1/dataset_evaluators/{dataset_evaluator_id}",
    {
      params: {
        path: { dataset_evaluator_id: datasetEvaluatorId },
        query: {
          ...(deleteAssociatedPrompt !== undefined && {
            delete_associated_prompt: deleteAssociatedPrompt,
          }),
        },
      },
    }
  );

  if (error) throw error;
}

/**
 * Parameters for deleting several dataset evaluator bindings at once.
 */
export interface DeleteDatasetEvaluatorsParams
  extends ClientFn, DeleteBindingOptions {
  /**
   * The GlobalIDs of the bindings, at most 1000.
   */
  datasetEvaluatorIds: string[];
}

/**
 * Delete several dataset evaluator bindings atomically.
 *
 * Either every binding is deleted or none is. Missing bindings are ignored,
 * but an ID that is not a dataset evaluator binding fails the whole request.
 *
 * @param params - The bindings to delete.
 * @param params.datasetEvaluatorIds - The binding GlobalIDs.
 * @param params.deleteAssociatedPrompt - Also delete LLM prompts. Defaults to `false`.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteDatasetEvaluators({
  client: _client,
  datasetEvaluatorIds,
  deleteAssociatedPrompt,
}: DeleteDatasetEvaluatorsParams): Promise<void> {
  if (datasetEvaluatorIds.length === 0) {
    throw new Error("At least one datasetEvaluatorId must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_DATASET_EVALUATORS,
  });

  const { error } = await client.POST("/v1/dataset_evaluators/delete", {
    body: {
      dataset_evaluator_ids: datasetEvaluatorIds,
      ...(deleteAssociatedPrompt !== undefined && {
        delete_associated_prompt: deleteAssociatedPrompt,
      }),
    },
  });

  if (error) throw error;
}
