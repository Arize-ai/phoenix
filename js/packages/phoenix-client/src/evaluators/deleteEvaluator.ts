import { createClient } from "../client";
import { DELETE_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting an unbound evaluator definition.
 */
export interface DeleteEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the LLM or code evaluator.
   */
  evaluatorId: string;
}

/**
 * Delete an LLM or code evaluator that nothing binds.
 *
 * A code evaluator is deleted with its version history; an LLM evaluator with
 * the tag that pins its version, keeping the prompt. A definition still bound
 * by a project or dataset is refused with 409: delete those bindings first.
 * Built-in evaluators cannot be deleted and are refused with 422. A missing
 * evaluator is ignored.
 *
 * @param params - The evaluator to delete.
 * @param params.evaluatorId - The evaluator GlobalID.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteEvaluator({
  client: _client,
  evaluatorId,
}: DeleteEvaluatorParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: DELETE_EVALUATOR });

  const { error } = await client.DELETE("/v1/evaluators/{evaluator_id}", {
    params: { path: { evaluator_id: evaluatorId } },
  });

  if (error) throw error;
}
