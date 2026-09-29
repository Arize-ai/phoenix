import { createClient } from "../client";
import { DELETE_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting an unbound code evaluator.
 */
export interface DeleteEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the code evaluator.
   */
  evaluatorId: string;
}

/**
 * Delete a code evaluator that nothing binds, with its version history.
 *
 * A definition still bound by a project or dataset is refused with 409;
 * delete those bindings first, or delete the last binding, which removes the
 * definition with it. LLM evaluators are deleted with their last binding and
 * built-in evaluators are never deleted, so their ids are refused with 422.
 * A missing evaluator is ignored.
 *
 * @param params - The evaluator to delete.
 * @param params.evaluatorId - The code evaluator GlobalID.
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
