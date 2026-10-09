import { createClient } from "../client";
import {
  DELETE_PROJECT_EVALUATOR,
  DELETE_PROJECT_EVALUATORS,
} from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting one project evaluator binding.
 */
export interface DeleteProjectEvaluatorParams extends ClientFn {
  /**
   * The GlobalID of the binding.
   */
  projectEvaluatorId: string;
}

/**
 * Delete a project evaluator binding; a missing binding is ignored.
 *
 * The binding's trace project and recorded traces are deleted. Its evaluator
 * definition and prompt are kept. Delete a definition that nothing binds with
 * `deleteEvaluator`.
 *
 * @param params - The binding to delete.
 * @param params.projectEvaluatorId - The binding GlobalID.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteProjectEvaluator({
  client: _client,
  projectEvaluatorId,
}: DeleteProjectEvaluatorParams): Promise<void> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_PROJECT_EVALUATOR,
  });

  const { error } = await client.DELETE(
    "/v1/project_evaluators/{project_evaluator_id}",
    { params: { path: { project_evaluator_id: projectEvaluatorId } } }
  );

  if (error) throw error;
}

/**
 * Parameters for deleting several of a project's evaluator bindings at once.
 */
export interface DeleteProjectEvaluatorsParams extends ClientFn {
  /**
   * The project the bindings belong to, by name or GlobalID.
   */
  project: ProjectIdentifier;
  /**
   * The GlobalIDs of the bindings, at most 1000.
   */
  projectEvaluatorIds: string[];
}

/**
 * Delete several of a project's evaluator bindings atomically.
 *
 * Either every binding is deleted or none is. Missing bindings are ignored; an
 * ID that is not a binding, or a binding of another project, fails the whole
 * request. Each deleted binding's trace project and recorded traces are removed;
 * evaluator definitions and prompts are kept.
 *
 * @param params - The project and the bindings to delete.
 * @param params.project - The project, by `project`, `projectId`, or `projectName`.
 * @param params.projectEvaluatorIds - The binding GlobalIDs.
 * @param params.client - An optional Phoenix client instance.
 *
 * @requires Phoenix server >= 21.0.0
 */
export async function deleteProjectEvaluators({
  client: _client,
  project,
  projectEvaluatorIds,
}: DeleteProjectEvaluatorsParams): Promise<void> {
  if (projectEvaluatorIds.length === 0) {
    throw new Error("At least one projectEvaluatorId must be provided");
  }

  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: DELETE_PROJECT_EVALUATORS,
  });

  const { error } = await client.DELETE(
    "/v1/projects/{project_identifier}/evaluators",
    {
      params: {
        path: { project_identifier: resolveProjectIdentifier(project) },
        query: { project_evaluator_id: projectEvaluatorIds },
      },
    }
  );

  if (error) throw error;
}
