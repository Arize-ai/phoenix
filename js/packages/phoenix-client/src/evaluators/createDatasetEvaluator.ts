import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_DATASET_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  DatasetEvaluator,
  DatasetEvaluatorCreate,
  DatasetIdentifier,
  EvaluatorInputMapping,
  EvaluatorOutputConfig,
  LLMEvaluatorDefinition,
} from "../types/evaluators";
import { resolveDatasetIdentifier } from "../types/evaluators";
import { assertUnreachable } from "../utils/assertUnreachable";
import { ensureServerCapability } from "../utils/serverVersionUtils";

type CategoricalOutputConfig = LLMEvaluatorDefinition["output_configs"][number];

/**
 * Fields every dataset binding takes, whatever the evaluator's kind.
 */
interface CreateDatasetEvaluatorBaseParams extends ClientFn {
  /**
   * The dataset to bind to, by ID or name.
   */
  dataset: DatasetIdentifier;
  /**
   * The binding's name, unique within the dataset.
   */
  name: string;
  /**
   * The GlobalID of the LLM, code, built-in, or decision evaluator to bind.
   * Create a definition first with `createEvaluator`.
   */
  evaluatorId: string;
  /**
   * How example and run fields map onto evaluator arguments.
   */
  inputMapping: EvaluatorInputMapping;
  /**
   * Overrides the shared definition's description for this binding.
   */
  description?: string;
}

/**
 * Parameters for binding an evaluator to a dataset. `evaluatorType` is the
 * evaluator's kind, as its definition's `type` reports it; the server refuses a
 * mismatch. `outputConfigs` overrides the shared definition's output
 * configurations for this binding with at least one config, each with its own
 * name; omit it to inherit them. An LLM evaluator's override must be
 * categorical and is not checked against the prompt. A decision binding takes
 * no override: its outputs follow the evaluator's questions and scoring policy.
 */
export type CreateDatasetEvaluatorParams = CreateDatasetEvaluatorBaseParams &
  (
    | { evaluatorType: "llm"; outputConfigs?: CategoricalOutputConfig[] }
    | {
        evaluatorType: "code" | "builtin";
        outputConfigs?: EvaluatorOutputConfig[];
      }
    | { evaluatorType: "decision" }
  );

function buildCreateBody(
  params: CreateDatasetEvaluatorParams
): DatasetEvaluatorCreate {
  const fields = {
    name: params.name,
    evaluator_id: params.evaluatorId,
    input_mapping: params.inputMapping,
    ...(params.description !== undefined && {
      description: params.description,
    }),
  };
  if (params.evaluatorType === "decision") {
    return { ...fields, evaluator_type: "decision" };
  }
  const overrides = params.outputConfigs !== undefined && {
    output_configs: params.outputConfigs,
  };
  switch (params.evaluatorType) {
    case "llm":
      return {
        ...fields,
        evaluator_type: "llm",
        ...(params.outputConfigs !== undefined && {
          output_configs: params.outputConfigs,
        }),
      };
    case "code":
      return { ...fields, evaluator_type: "code", ...overrides };
    case "builtin":
      return { ...fields, evaluator_type: "builtin", ...overrides };
    default:
      return assertUnreachable(params);
  }
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
 * @param params.evaluatorType - The evaluator's kind; it must match the definition.
 * @param params.description - Optional description override.
 * @param params.outputConfigs - Optional output configuration overrides, at least one when given. Not taken by decision bindings.
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
 *   evaluatorType: "code",
 *   inputMapping: { literal_mapping: {}, path_mapping: { output: "output" } },
 * });
 * ```
 */
export async function createDatasetEvaluator(
  params: CreateDatasetEvaluatorParams
): Promise<DatasetEvaluator> {
  const client = params.client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: CREATE_DATASET_EVALUATOR,
  });

  const { data, error } = await client.POST(
    "/v1/datasets/{dataset_identifier}/evaluators",
    {
      params: {
        path: { dataset_identifier: resolveDatasetIdentifier(params.dataset) },
      },
      body: buildCreateBody(params),
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to create dataset evaluator");
  return data.data;
}
