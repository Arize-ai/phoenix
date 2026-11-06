import invariant from "tiny-invariant";

import { createClient } from "../client";
import { SET_PROJECT_ANNOTATION_CONFIGS } from "../constants/serverRequirements";
import type { AnnotationConfig } from "../types/annotationConfigs";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for replacing the annotation configs assigned to a project.
 */
export type SetProjectAnnotationConfigsParams = ClientFn &
  ProjectIdentifier & {
    /**
     * The GlobalIDs of every annotation config that should be assigned to the
     * project. Configs not in this list are unassigned; an empty list clears
     * all assignments.
     */
    configIds: string[];
  };

/**
 * Replace the full set of annotation configs assigned to a project.
 *
 * Configs in `configIds` that are not yet assigned are added, and assigned
 * configs missing from `configIds` are removed. The annotation configs
 * themselves are never deleted.
 *
 * @param params - The project and its desired annotation configs.
 * @param params.project - A project name or GlobalID.
 * @param params.projectId - A project GlobalID.
 * @param params.projectName - A project name.
 * @param params.configIds - The annotation config GlobalIDs to assign.
 * @param params.client - An optional Phoenix client instance.
 * @returns The annotation configs assigned to the project after the update.
 * @throws {@link HttpError} when Phoenix rejects the request, e.g. with a 404
 * if the project does not exist or a 422 if any config ID is invalid or
 * missing.
 *
 * @requires Phoenix server >= 17.16.0
 *
 * @example
 * ```ts
 * import { setProjectAnnotationConfigs } from "@arizeai/phoenix-client/projects";
 *
 * await setProjectAnnotationConfigs({
 *   projectName: "support-bot",
 *   configIds: ["Q2F0ZWdvcmljYWxBbm5vdGF0aW9uQ29uZmlnOjE="],
 * });
 *
 * // Clear every assignment
 * await setProjectAnnotationConfigs({
 *   projectName: "support-bot",
 *   configIds: [],
 * });
 * ```
 */
export async function setProjectAnnotationConfigs(
  params: SetProjectAnnotationConfigsParams
): Promise<AnnotationConfig[]> {
  const client = params.client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: SET_PROJECT_ANNOTATION_CONFIGS,
  });

  const { data, error } = await client.PUT(
    "/v1/projects/{project_identifier}/annotation_configs",
    {
      params: {
        path: {
          project_identifier: resolveProjectIdentifier(params),
        },
      },
      body: {
        annotation_config_ids: params.configIds,
      },
    }
  );

  if (error) throw error;
  invariant(data?.data, "Failed to set project annotation configs");
  return data.data;
}
