import invariant from "tiny-invariant";

import { createClient } from "../client";
import { GET_PROJECT_EVALUATOR } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { ProjectEvaluator } from "../types/evaluators";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for reading a project evaluator binding.
 */
export interface GetProjectEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the binding.
   */
  projectEvaluatorId: string;
}

/**
 * Read a project evaluator binding by ID.
 *
 * @param params - The binding to read.
 * @param params.projectEvaluatorId - The binding GlobalID.
 * @param params.client - An optional Phoenix client instance.
 * @returns The binding. A null `input_mapping` means the binding uses the
 * shared definition's mapping.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function getProjectEvaluator({
  client: _client,
  projectEvaluatorId,
}: GetProjectEvaluatorParams): Promise<ProjectEvaluator> {
  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: GET_PROJECT_EVALUATOR });

  const { data, error } = await client.GET(
    "/v1/project_evaluators/{project_evaluator_id}",
    { params: { path: { project_evaluator_id: projectEvaluatorId } } }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to get project evaluator");
  return data.data;
}
