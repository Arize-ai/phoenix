import invariant from "tiny-invariant";

import { createClient } from "../client";
import { ASSIGN_PROJECT_ANNOTATION_CONFIG } from "../constants/serverRequirements";
import type {
  AnnotationConfig,
  AnnotationConfigIdentifier,
} from "../types/annotationConfigs";
import { resolveAnnotationConfigIdentifier } from "../types/annotationConfigs";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for assigning an annotation config to a project.
 */
export type AssignProjectAnnotationConfigParams = ClientFn &
  ProjectIdentifier &
  AnnotationConfigIdentifier;

/**
 * Assign an existing annotation config to a project.
 *
 * Assignment is idempotent: assigning a config that is already assigned to
 * the project succeeds and returns the config.
 *
 * @param params - The project and annotation config to assign.
 * @param params.project - A project name or GlobalID.
 * @param params.projectId - A project GlobalID.
 * @param params.projectName - A project name.
 * @param params.config - An annotation config name or GlobalID.
 * @param params.configId - An annotation config GlobalID.
 * @param params.configName - An annotation config name.
 * Use `configId` instead if the name may contain `/`, which the server
 * cannot route.
 * @param params.client - An optional Phoenix client instance.
 * @returns The assigned annotation config.
 * @throws {@link HttpError} when Phoenix rejects the request, e.g. with a 404
 * if the project or annotation config does not exist.
 *
 * @requires Phoenix server >= 17.16.0
 *
 * @example
 * ```ts
 * import { assignProjectAnnotationConfig } from "@arizeai/phoenix-client/projects";
 *
 * const config = await assignProjectAnnotationConfig({
 *   projectName: "support-bot",
 *   configName: "correctness",
 * });
 * ```
 */
export async function assignProjectAnnotationConfig(
  params: AssignProjectAnnotationConfigParams
): Promise<AnnotationConfig> {
  const client = params.client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: ASSIGN_PROJECT_ANNOTATION_CONFIG,
  });

  const { data, error } = await client.PUT(
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
  invariant(data?.data, "Failed to assign annotation config to project");
  return data.data;
}
