import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_DATASET_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  DatasetEvaluator,
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
   * The GlobalID of the LLM, code, or built-in evaluator to bind. Create a
   * definition first with `createEvaluator`.
   */
  evaluatorId: string;
  /**
   * How example and run fields map onto evaluator arguments.
   */
  inputMapping: EvaluatorInputMapping;
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
 * Bind an existing evaluator definition to a dataset.
 *
 * A binding registers the evaluator to run against the dataset's experiments.
 * It does not run an experiment by itself.
 *
 * @param params - The dataset, binding fields, and evaluator.
 * @param params.dataset - The dataset, by `dataset` (name or ID), `datasetId`, or `datasetName`. An ID wins when a dataset is also named by the same string.
 * @param params.name - The binding's name.
 * @param params.inputMapping - How record fields map onto evaluator arguments.
 * @param params.evaluatorId - The evaluator definition GlobalID.
 * @param params.description - Optional description override.
 * @param params.outputConfigs - Optional output configuration overrides, at least one when given.
 * @param params.client - An optional Phoenix client instance.
 * @returns The created binding. A name the dataset already uses is refused with
 * 409; the thrown `HttpError` has `problem.code` `already_exists` and
 * `problem.existing_id`.
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
 *   evaluatorId: "Q29kZUV2YWx1YXRvcjoy",
 *   inputMapping: { literal_mapping: {}, path_mapping: { output: "output" } },
 * });
 * ```
 */
export async function createDatasetEvaluator({
  client: _client,
  dataset,
  name,
  evaluatorId,
  inputMapping,
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
        evaluator_id: evaluatorId,
        input_mapping: inputMapping,
        ...(description !== undefined && { description }),
        ...(outputConfigs !== undefined && { output_configs: outputConfigs }),
      },
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to create dataset evaluator");
  return data.data;
}
