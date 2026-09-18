import { createClient } from "../client";
import {
  DELETE_PROJECT_EVALUATOR,
  DELETE_PROJECT_EVALUATORS,
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
 * Parameters for deleting one project evaluator binding.
 */
export interface DeleteProjectEvaluatorParams
  extends ClientFn, DeleteBindingOptions {
  /**
   * The GlobalID of the binding.
   */
  projectEvaluatorId: string;
}

/**
 * Delete a project evaluator binding and its evaluator traces.
 *
 * The shared definition is deleted once nothing else references it. A missing
 * binding is ignored.
 *
 * @param params - The binding to delete.
 * @param params.projectEvaluatorId - The binding GlobalID.
 * @param params.deleteAssociatedPrompt - Also delete the LLM prompt. Defaults to `false`.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteProjectEvaluator({
  client: _client,
  projectEvaluatorId,
  deleteAssociatedPrompt,
}: DeleteProjectEvaluatorParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_PROJECT_EVALUATOR,
  });

  const { error } = await client.DELETE(
    "/v1/project_evaluators/{project_evaluator_id}",
    {
      params: {
        path: { project_evaluator_id: projectEvaluatorId },
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
 * Parameters for deleting several project evaluator bindings at once.
 */
export interface DeleteProjectEvaluatorsParams
  extends ClientFn, DeleteBindingOptions {
  /**
   * The GlobalIDs of the bindings, at most 1000.
   */
  projectEvaluatorIds: string[];
}

/**
 * Delete several project evaluator bindings atomically.
 *
 * Either every binding is deleted or none is. Missing bindings are ignored,
 * but an ID that is not a project evaluator binding fails the whole request.
 *
 * @param params - The bindings to delete.
 * @param params.projectEvaluatorIds - The binding GlobalIDs.
 * @param params.deleteAssociatedPrompt - Also delete LLM prompts. Defaults to `false`.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteProjectEvaluators({
  client: _client,
  projectEvaluatorIds,
  deleteAssociatedPrompt,
}: DeleteProjectEvaluatorsParams): Promise<void> {
  if (projectEvaluatorIds.length === 0) {
    throw new Error("At least one projectEvaluatorId must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_PROJECT_EVALUATORS,
  });

  const { error } = await client.POST("/v1/project_evaluators/delete", {
    body: {
      project_evaluator_ids: projectEvaluatorIds,
      ...(deleteAssociatedPrompt !== undefined && {
        delete_associated_prompt: deleteAssociatedPrompt,
      }),
    },
  });

  if (error) throw error;
}
