import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_PROJECT_EVALUATORS } from "../constants/serverRequirements";
import type { ClientFn } from "../types/core";
import type { ProjectEvaluator } from "../types/evaluators";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for listing the evaluators bound to a project.
 */
export type GetProjectEvaluatorsParams = ClientFn & {
  /**
   * The project, by name or GlobalID.
   */
  project: ProjectIdentifier;
  /**
   * Stop after this many bindings. Pagination is followed to the end by
   * default.
   */
  limit?: number;
};

type ProjectEvaluatorsPage =
  components["schemas"]["ProjectEvaluatorsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List every evaluator bound to a project, newest first. Pagination is
 * handled for you.
 *
 * @param params - The project to list bindings for.
 * @param params.project - The project, by `project`, `projectId`, or `projectName`.
 * @param params.limit - Stop after this many bindings.
 * @param params.client - An optional Phoenix client instance.
 * @returns All bindings on the project.
 *
 * @requires Phoenix server >= 21.0.0
 *
 * @example
 * ```ts
 * import { getProjectEvaluators } from "@arizeai/phoenix-client/evaluators";
 *
 * const bindings = await getProjectEvaluators({
 *   project: { projectName: "support-bot" },
 * });
 * for (const binding of bindings) {
 *   console.log(binding.id, binding.name, binding.evaluation_target);
 * }
 * ```
 */
export async function getProjectEvaluators({
  client: _client,
  project,
  limit,
}: GetProjectEvaluatorsParams): Promise<ProjectEvaluator[]> {
  const client = _client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: LIST_PROJECT_EVALUATORS,
  });

  const projectIdentifier = resolveProjectIdentifier(project);
  const bindings: ProjectEvaluator[] = [];
  let cursor: string | null | undefined = null;

  do {
    const remaining =
      limit === undefined ? DEFAULT_PAGE_SIZE : limit - bindings.length;
    const response: { data?: ProjectEvaluatorsPage; error?: unknown } =
      await client.GET("/v1/projects/{project_identifier}/evaluators", {
        params: {
          path: { project_identifier: projectIdentifier },
          query: {
            cursor,
            limit: Math.max(1, Math.min(remaining, DEFAULT_PAGE_SIZE)),
          },
        },
      });

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list project evaluators");

    cursor = response.data.next_cursor ?? null;
    bindings.push(...response.data.data);
    if (limit !== undefined && bindings.length >= limit) {
      return bindings.slice(0, limit);
    }
  } while (cursor != null);

  return bindings;
}
