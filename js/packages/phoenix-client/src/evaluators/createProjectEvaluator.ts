import invariant from "tiny-invariant";

import { createClient } from "../client";
import { CREATE_PROJECT_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  EvaluationTarget,
  EvaluatorInputMapping,
  ProjectEvaluator,
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
   * The GlobalID of the LLM or code evaluator to bind. Create a definition
   * first with `createEvaluator`.
   */
  evaluatorId: string;
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
   * How record fields map onto evaluator arguments. Omit it to use the shared
   * definition's mapping. LLM evaluators have none, so their template
   * variables bind to record fields of the same name.
   */
  inputMapping?: EvaluatorInputMapping;
  /**
   * For `TRACE` and `SESSION` targets, how long the trace or session must be
   * quiet before it is evaluated. Defaults to the server's setting for the
   * target. Rejected for `SPAN` targets, which evaluate spans as they arrive.
   */
  evaluationDelaySeconds?: number;
};

/**
 * Bind an existing evaluator definition to a project so it runs on incoming
 * traces.
 *
 * @param params - The project, scheduling fields, and evaluator.
 * @param params.project - The project, by `project`, `projectId`, or `projectName`.
 * @param params.name - The binding's name.
 * @param params.evaluationTarget - `SPAN`, `TRACE`, or `SESSION`.
 * @param params.samplingRate - Fraction of matching records to evaluate.
 * @param params.evaluatorId - The evaluator definition GlobalID.
 * @param params.filterCondition - Optional filter expression in the language of the evaluation target.
 * @param params.enabled - Optional; defaults to enabled.
 * @param params.inputMapping - Optional input mapping.
 * @param params.evaluationDelaySeconds - Optional quiet-period delay for `TRACE` and `SESSION` targets.
 * @param params.client - An optional Phoenix client instance.
 * @returns The created binding. `evaluation_delay_seconds` is `0` for `SPAN`
 * targets. A name the project already uses is refused with 409; the thrown
 * `HttpError` has `problem.code` `already_exists` and `problem.existing_id`.
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
 *   evaluatorId: "Q29kZUV2YWx1YXRvcjox",
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
  evaluatorId,
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
        evaluator_id: evaluatorId,
        evaluation_target: evaluationTarget,
        sampling_rate: samplingRate,
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
