import invariant from "tiny-invariant";

import { createClient } from "../client";
import { PATCH_PROJECT_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type {
  ProjectEvaluator,
  ProjectEvaluatorPatch,
} from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for updating a project evaluator binding.
 */
export interface UpdateProjectEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the binding.
   */
  projectEvaluatorId: string;
  /**
   * The fields to change. At least one must be present; omitted fields keep
   * their current values. The evaluation target cannot change. Set
   * `input_mapping` to `null` to use the shared definition's mapping again, or
   * `evaluation_delay_seconds` to `null` to restore the server's default.
   */
  patch: ProjectEvaluatorPatch;
}

/**
 * Update a project evaluator binding, for example to pause it or change its
 * sampling rate.
 *
 * @param params - The binding and the fields to change.
 * @param params.projectEvaluatorId - The binding GlobalID.
 * @param params.patch - The fields to change.
 * @param params.client - An optional Phoenix client instance.
 * @returns The updated binding.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { updateProjectEvaluator } from "@arizeai/phoenix-client/evaluators";
 *
 * await updateProjectEvaluator({
 *   projectEvaluatorId: "UHJvamVjdEV2YWx1YXRvcjox",
 *   patch: { enabled: false },
 * });
 * ```
 */
export async function updateProjectEvaluator({
  client: _client,
  projectEvaluatorId,
  patch,
}: UpdateProjectEvaluatorParams): Promise<ProjectEvaluator> {
  if (Object.keys(patch).length === 0) {
    throw new Error("At least one field to update must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: PATCH_PROJECT_EVALUATOR,
  });

  const { data, error } = await client.PATCH(
    "/v1/project_evaluators/{project_evaluator_id}",
    {
      params: { path: { project_evaluator_id: projectEvaluatorId } },
      body: patch,
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to update project evaluator");
  return data.data;
}
