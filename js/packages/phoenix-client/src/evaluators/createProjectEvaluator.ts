import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_PROJECT_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  EvaluationTarget,
  EvaluatorInputMapping,
  ProjectEvaluator,
  ProjectEvaluatorInput,
} from "../types/evaluators";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for binding an evaluator to a project.
 */
export type CreateProjectEvaluatorParams = ClientFn & {
  /**
   * The project to bind to, by name or GlobalID.
   */
  project: ProjectIdentifier;
  /**
   * The binding's name, unique within the project.
   */
  name: string;
  /**
   * What the evaluator runs on: `SPAN`, `TRACE`, or `SESSION`.
   */
  evaluationTarget: EvaluationTarget;
  /**
   * The fraction of matching records to evaluate, between 0 and 1.
   */
  samplingRate: number;
  /**
   * The evaluator to bind: a new LLM or code evaluator, or a reference to an
   * existing code evaluator. LLM evaluators cannot be referenced because each
   * one is tied to its own prompt. A new LLM evaluator gives either
   * `prompt_version` content for a new prompt or `prompt_version_id` of an
   * existing version, not both, and its `description` must equal the
   * description of its prompt's tool function. A new code evaluator needs at
   * least one `output_configs` entry.
   */
  evaluator: ProjectEvaluatorInput;
  /**
   * A filter expression, in the language of the evaluation target (span,
   * trace, or session), that records must match to be evaluated.
   */
  filterCondition?: string;
  /**
   * Whether the binding is active. Defaults to enabled on the server.
   */
  enabled?: boolean;
  /**
   * How record fields map onto evaluator arguments. Required for LLM
   * evaluators; code and referenced evaluators may omit it to use the shared
   * definition's mapping.
   */
  inputMapping?: EvaluatorInputMapping;
  /**
   * For `TRACE` and `SESSION` targets, how many seconds the trace or session
   * must be quiet before it is evaluated: at least 10, and 300 when omitted.
   * Rejected for `SPAN` targets, which evaluate spans as they arrive and store
   * a delay of 0.
   */
  evaluationDelaySeconds?: number;
};

/**
 * Bind an evaluator to a project so it runs on incoming traces, creating the
 * evaluator if needed.
 *
 * @param params - The project, scheduling fields, and evaluator.
 * @param params.project - The project, by `project`, `projectId`, or `projectName`.
 * @param params.name - The binding's name.
 * @param params.evaluationTarget - `SPAN`, `TRACE`, or `SESSION`.
 * @param params.samplingRate - Fraction of matching records to evaluate.
 * @param params.evaluator - A new evaluator or `{ type: "reference", evaluator_id }`.
 * @param params.filterCondition - Optional filter expression in the language of the evaluation target.
 * @param params.enabled - Optional; defaults to enabled.
 * @param params.inputMapping - Optional input mapping.
 * @param params.evaluationDelaySeconds - Optional quiet-period delay in seconds for `TRACE` and `SESSION` targets: at least 10, default 300.
 * @param params.client - An optional Phoenix client instance.
 * @returns The created binding. `evaluation_delay_seconds` is `0` for `SPAN` targets.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { createProjectEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * await createProjectEvaluator({
 *   project: { projectName: "support-bot" },
 *   name: "toxicity",
 *   evaluationTarget: "SPAN",
 *   samplingRate: 0.25,
 *   evaluator: { type: "reference", evaluator_id: "Q29kZUV2YWx1YXRvcjox" },
 *   filterCondition: "span_kind == 'LLM'",
 * });
 * ```
 */
export async function createProjectEvaluator({
  client: _client,
  project,
  name,
  evaluationTarget,
  samplingRate,
  evaluator,
  filterCondition,
  enabled,
  inputMapping,
  evaluationDelaySeconds,
}: CreateProjectEvaluatorParams): Promise<ProjectEvaluator> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: CREATE_PROJECT_EVALUATOR,
  });

  const { data, error } = await client.POST(
    "/v1/projects/{project_identifier}/evaluators",
    {
      params: {
        path: { project_identifier: resolveProjectIdentifier(project) },
      },
      body: {
        name,
        evaluation_target: evaluationTarget,
        sampling_rate: samplingRate,
        evaluator,
        ...(filterCondition !== undefined && {
          filter_condition: filterCondition,
        }),
        ...(enabled !== undefined && { enabled }),
        ...(inputMapping !== undefined && { input_mapping: inputMapping }),
        ...(evaluationDelaySeconds !== undefined && {
          evaluation_delay_seconds: evaluationDelaySeconds,
        }),
      },
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to create project evaluator");
  return data.data;
}
