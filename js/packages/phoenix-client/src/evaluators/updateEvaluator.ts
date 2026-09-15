import invariant from "tiny-invariant";

import { createClient } from "../client";
import { PATCH_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { EvaluatorDefinition, EvaluatorPatch } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for updating a shared evaluator definition.
 */
export interface UpdateEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the evaluator.
   */
  evaluatorId: string;
  /**
   * The fields to change. `type` must be `"llm"` or `"code"` to match the
   * evaluator, and at least one other field must be present. Omitted fields
   * keep their current values.
   */
  patch: EvaluatorPatch;
}

/**
 * Update a shared evaluator definition.
 *
 * The change applies to every project and dataset binding that references the
 * evaluator. Code is immutable per version: to change a code evaluator's
 * source, use {@link createCodeEvaluatorVersion}. Prompt content is edited through
 * the prompts API: create a version with `createPrompt` and pass its `id` as
 * `prompt_version_id`. An LLM evaluator's `description` must equal the
 * description of its prompt's tool function. The server refuses with 409 an
 * LLM change that would invalidate a dataset binding's output overrides.
 *
 * @param params - The evaluator and the fields to change.
 * @param params.evaluatorId - The evaluator GlobalID.
 * @param params.patch - The fields to change, discriminated by `type`.
 * @param params.client - An optional Phoenix client instance.
 * @returns The updated evaluator definition.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { updateEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * await updateEvaluator({
 *   evaluatorId: "TExNRXZhbHVhdG9yOjE=",
 *   patch: { type: "llm", prompt_version_id: "UHJvbXB0VmVyc2lvbjo3" },
 * });
 * ```
 */
export async function updateEvaluator({
  client: _client,
  evaluatorId,
  patch,
}: UpdateEvaluatorParams): Promise<EvaluatorDefinition> {
  const { type: _type, ...fields } = patch;
  if (Object.keys(fields).length === 0) {
    throw new Error("At least one field to update must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: PATCH_EVALUATOR });

  const { data, error } = await client.PATCH("/v1/evaluators/{evaluator_id}", {
    params: { path: { evaluator_id: evaluatorId } },
    body: patch,
  });

  if (error) throw error;
  invariant(data?.data, "Failed to update evaluator");
  return data.data;
}
