import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";

/**
 * The retention-policy assignment returned for a project.
 */
export type ProjectRetentionPolicyAssignment =
  components["schemas"]["ProjectRetentionPolicyData"];

/**
 * Parameters for assigning or resetting a project's retention policy.
 */
export type SetProjectRetentionPolicyParams = ClientFn &
  ProjectIdentifier & {
    /**
     * The GlobalID of an existing trace retention policy, or `null` to reset
     * the project to the default policy.
     */
    policyId: string | null;
  };

/**
 * Assign an existing trace retention policy to a project, or reset the project
 * to the default policy.
 *
 * This helper only changes the project's assignment. It does not create,
 * retrieve, update, or delete retention policies.
 *
 * @param params - The project and policy assignment.
 * @param params.project - A project name or GlobalID.
 * @param params.projectId - A project GlobalID.
 * @param params.projectName - A project name.
 * @param params.policyId - An existing policy GlobalID, or `null` to reset.
 * @param params.client - An optional Phoenix client instance.
 * @returns The project's resulting retention-policy assignment.
 *
 * @example
 * ```ts
 * import { setProjectRetentionPolicy } from "@arizeai/phoenix-client/projects";
 *
 * await setProjectRetentionPolicy({
 *   projectName: "support-bot",
 *   policyId: "UHJvamVjdFRyYWNlUmV0ZW50aW9uUG9saWN5OjI=",
 * });
 *
 * await setProjectRetentionPolicy({
 *   projectId: "UHJvamVjdDox",
 *   policyId: null,
 * });
 * ```
 */
export async function setProjectRetentionPolicy(
  params: SetProjectRetentionPolicyParams
): Promise<ProjectRetentionPolicyAssignment> {
  const client = params.client ?? createClient();
  const projectIdentifier = resolveProjectIdentifier(params);

  const { data, error } = await client.PATCH(
    "/v1/projects/{project_identifier}/retention",
    {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
      },
      body: {
        policy_id: params.policyId,
      },
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to set project retention policy");
  return data.data;
}
