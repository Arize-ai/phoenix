import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  CodeEvaluatorDefinition,
  EvaluatorCreate,
  LLMEvaluatorDefinition,
} from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for creating an evaluator definition that nothing binds yet.
 */
export interface CreateEvaluatorParams extends ClientFn {
  /**
   * The evaluator to create. `type: "llm"` pins an existing prompt version,
   * which is created through the prompts API first; `type: "code"` is created
   * with its first version.
   */
  evaluator: EvaluatorCreate;
}

/**
 * Create an LLM or code evaluator definition without binding it.
 *
 * The name must be unique among evaluators; a clash is refused with 409 and an
 * `HttpError` whose `problem.code` is `already_exists` and whose
 * `problem.existing_id` names the evaluator holding the name. Bind the result
 * to a project or dataset afterwards by its `id`.
 *
 * @param params - The evaluator to create.
 * @param params.evaluator - The definition, discriminated by `type`.
 * @param params.client - An optional Phoenix client instance.
 * @returns The created evaluator definition.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { createEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * const evaluator = await createEvaluator({
 *   evaluator: {
 *     type: "llm",
 *     name: "correctness",
 *     description: "correctness",
 *     prompt: { selector: { type: "version", prompt_version_id: "UHJvbXB0VmVyc2lvbjo3" } },
 *     output_configs: [
 *       {
 *         type: "CATEGORICAL",
 *         name: "correctness",
 *         optimization_direction: "MAXIMIZE",
 *         values: [{ label: "correct", score: 1 }, { label: "incorrect", score: 0 }],
 *       },
 *     ],
 *   },
 * });
 * ```
 */
export async function createEvaluator({
  client: _client,
  evaluator,
}: CreateEvaluatorParams): Promise<
  LLMEvaluatorDefinition | CodeEvaluatorDefinition
> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: CREATE_EVALUATOR });

  const { data, error } = await client.POST("/v1/evaluators", {
    body: evaluator,
  });

  if (error) throw error;
  invariant(data?.data, "Failed to create evaluator");
  return data.data;
}
