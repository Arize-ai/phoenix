import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  CodeEvaluatorCreate,
  CodeEvaluatorDefinition,
} from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for creating a code evaluator that nothing binds yet.
 */
export interface CreateEvaluatorParams extends ClientFn {
  /**
   * The evaluator to create. Only `type: "code"` is accepted; LLM evaluators
   * are created through the project and dataset binding helpers because each
   * one is tied to its own prompt.
   */
  evaluator: CodeEvaluatorCreate;
}

/**
 * Create a code evaluator with its first version, without binding it.
 *
 * The name must be unique among evaluators; the server refuses a clash with
 * 409. Bind the result to a project or dataset afterwards by its `id`.
 *
 * @param params - The evaluator to create.
 * @param params.evaluator - Name, source, language, sandbox, input mapping, at least one output config, and an optional description.
 * @param params.client - An optional Phoenix client instance.
 * @returns The created code evaluator definition.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { readFile } from "node:fs/promises";
 * import { createEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * const evaluator = await createEvaluator({
 *   evaluator: {
 *     type: "code",
 *     name: "exact-match",
 *     source_code: await readFile("evaluator.py", "utf8"),
 *     language: "PYTHON",
 *     sandbox_config_id: "U2FuZGJveENvbmZpZzox",
 *     input_mapping: { literal_mapping: {}, path_mapping: { output: "output" } },
 *     output_configs: [
 *       { type: "CONTINUOUS", name: "score", optimization_direction: "MAXIMIZE" },
 *     ],
 *   },
 * });
 * ```
 */
export async function createEvaluator({
  client: _client,
  evaluator,
}: CreateEvaluatorParams): Promise<CodeEvaluatorDefinition> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: CREATE_EVALUATOR });

  const { data, error } = await client.POST("/v1/evaluators", {
    body: evaluator,
  });

  if (error) throw error;
  invariant(data?.data, "Failed to create evaluator");
  invariant(data.data.type === "code", "Expected a code evaluator");
  return data.data;
}
