import { createClient } from "../client";
import { UNASSIGN_PROJECT_ANNOTATION_CONFIG } from "../constants/serverRequirements";
import type { AnnotationConfigIdentifier } from "../types/annotationConfigs";
import { resolveAnnotationConfigIdentifier } from "../types/annotationConfigs";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for unassigning an annotation config from a project.
 */
export type UnassignProjectAnnotationConfigParams = ClientFn &
  ProjectIdentifier &
  AnnotationConfigIdentifier;

/**
 * Unassign an annotation config from a project.
 *
 * Unassignment is idempotent: unassigning a config that is not assigned to
 * the project succeeds. The annotation config itself is not deleted.
 *
 * @param params - The project and annotation config to unassign.
 * @param params.project - A project name or GlobalID.
 * @param params.projectId - A project GlobalID.
 * @param params.projectName - A project name.
 * @param params.config - An annotation config name or GlobalID.
 * @param params.configId - An annotation config GlobalID.
 * @param params.configName - An annotation config name.
 * Use `configId` instead if the name may contain `/`, which the server
 * cannot route.
 * @param params.client - An optional Phoenix client instance.
 * @returns A promise that resolves once the config is unassigned.
 * @throws {@link HttpError} when Phoenix rejects the request, e.g. with a 404
 * if the project or annotation config does not exist.
 *
 * @requires Phoenix server >= 17.16.0
 *
 * @example
 * ```ts
 * import { unassignProjectAnnotationConfig } from "@arizeai/phoenix-client/projects";
 *
 * await unassignProjectAnnotationConfig({
 *   projectName: "support-bot",
 *   configName: "correctness",
 * });
 * ```
 */
export async function unassignProjectAnnotationConfig(
  params: UnassignProjectAnnotationConfigParams
): Promise<void> {
  const client = params.client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: UNASSIGN_PROJECT_ANNOTATION_CONFIG,
  });

  const { error } = await client.DELETE(
    "/v1/projects/{project_identifier}/annotation_configs/{config_identifier}",
    {
      params: {
        path: {
          project_identifier: resolveProjectIdentifier(params),
          config_identifier: resolveAnnotationConfigIdentifier(params),
        },
      },
    }
  );

  if (error) throw error;
}
