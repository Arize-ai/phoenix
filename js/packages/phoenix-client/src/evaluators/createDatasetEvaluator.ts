import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_DATASET_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  DatasetEvaluator,
  DatasetEvaluatorInput,
  DatasetIdentifier,
  EvaluatorInputMapping,
  EvaluatorOutputConfig,
} from "../types/evaluators";
import { resolveDatasetIdentifier } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for binding an evaluator to a dataset.
 */
export interface CreateDatasetEvaluatorParams extends ClientFn {
  /**
   * The dataset to bind to, by ID or name.
   */
  dataset: DatasetIdentifier;
  /**
   * The binding's name, unique within the dataset.
   */
  name: string;
  /**
   * How example and run fields map onto evaluator arguments.
   */
  inputMapping: EvaluatorInputMapping;
  /**
   * The evaluator to bind: a new LLM or code evaluator, or a reference to an
   * existing code or built-in evaluator. LLM evaluators cannot be referenced
   * because each one is tied to its own prompt. A new LLM evaluator gives
   * either `prompt_version` content for a new prompt or `prompt_version_id`
   * of an existing version, not both, and its `description` must equal the
   * description of its prompt's tool function. A new code evaluator needs at
   * least one `output_configs` entry.
   */
  evaluator: DatasetEvaluatorInput;
  /**
   * Overrides the shared definition's description for this binding. For LLM
   * evaluators it must equal the description of the prompt's tool function.
   */
  description?: string;
  /**
   * Overrides the shared definition's output configurations for this binding
   * with at least one config; omit it to inherit them. For LLM evaluators the
   * override must match the prompt's tool schema.
   */
  outputConfigs?: EvaluatorOutputConfig[];
}

/**
 * Bind an evaluator to a dataset, creating the evaluator if needed.
 *
 * A binding registers the evaluator to run against the dataset's experiments.
 * It does not run an experiment by itself.
 *
 * @param params - The dataset, binding fields, and evaluator.
 * @param params.dataset - The dataset, by `dataset` (name or ID), `datasetId`, or `datasetName`. An ID wins when a dataset is also named by the same string.
 * @param params.name - The binding's name.
 * @param params.inputMapping - How record fields map onto evaluator arguments.
 * @param params.evaluator - A new evaluator or `{ type: "reference", evaluator_id }`.
 * @param params.description - Optional description override.
 * @param params.outputConfigs - Optional output configuration overrides, at least one when given.
 * @param params.client - An optional Phoenix client instance.
 * @returns The created binding.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { createDatasetEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * await createDatasetEvaluator({
 *   dataset: { datasetName: "golden-questions" },
 *   name: "exact-match",
 *   inputMapping: { literal_mapping: {}, path_mapping: { output: "output" } },
 *   evaluator: { type: "reference", evaluator_id: "Q29kZUV2YWx1YXRvcjoy" },
 * });
 * ```
 */
export async function createDatasetEvaluator({
  client: _client,
  dataset,
  name,
  inputMapping,
  evaluator,
  description,
  outputConfigs,
}: CreateDatasetEvaluatorParams): Promise<DatasetEvaluator> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: CREATE_DATASET_EVALUATOR,
  });

  const { data, error } = await client.POST(
    "/v1/datasets/{dataset_identifier}/evaluators",
    {
      params: {
        path: { dataset_identifier: resolveDatasetIdentifier(dataset) },
      },
      body: {
        name,
        input_mapping: inputMapping,
        evaluator,
        ...(description !== undefined && { description }),
        ...(outputConfigs !== undefined && { output_configs: outputConfigs }),
      },
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to create dataset evaluator");
  return data.data;
}
