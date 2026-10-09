import invariant from "tiny-invariant";

import { createClient } from "../client";
import { GET_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { EvaluatorDefinition } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for reading a shared evaluator definition.
 */
export interface GetEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the evaluator.
   */
  evaluatorId: string;
}

/**
 * Read a shared evaluator definition by ID.
 *
 * Definitions are shared by every project and dataset binding that references
 * them. Inspect the returned `type` to tell LLM, code, and built-in evaluators
 * apart.
 *
 * @param params - The evaluator to read.
 * @param params.evaluatorId - The evaluator GlobalID.
 * @param params.client - An optional Phoenix client instance.
 * @returns The evaluator definition.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { getEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * const evaluator = await getEvaluator({ evaluatorId: "Q29kZUV2YWx1YXRvcjoy" });
 * if (evaluator.type === "code") {
 *   console.log(evaluator.source_code);
 * }
 * ```
 */
export async function getEvaluator({
  client: _client,
  evaluatorId,
}: GetEvaluatorParams): Promise<EvaluatorDefinition> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: GET_EVALUATOR });

  const { data, error } = await client.GET("/v1/evaluators/{evaluator_id}", {
    params: { path: { evaluator_id: evaluatorId } },
  });

  if (error) throw error;
  invariant(data?.data, "Failed to get evaluator");
  return data.data;
}
