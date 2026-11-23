import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import { LIST_PROJECT_ANNOTATION_CONFIGS } from "../constants/serverRequirements";
import type { AnnotationConfig } from "../types/annotationConfigs";
import type { ClientFn } from "../types/core";
import type { ProjectIdentifier } from "../types/projects";
import { resolveProjectIdentifier } from "../types/projects";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for listing the annotation configs assigned to a project.
 */
export type ListProjectAnnotationConfigsParams = ClientFn & ProjectIdentifier;

type ProjectAnnotationConfigsResponse =
  components["schemas"]["GetProjectAnnotationConfigsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List every annotation config assigned to a project, with automatic
 * pagination handling.
 *
 * @param params - The project whose assigned configs should be listed.
 * @param params.project - A project name or GlobalID.
 * @param params.projectId - A project GlobalID.
 * @param params.projectName - A project name.
 * @param params.client - An optional Phoenix client instance.
 * @returns The annotation configs assigned to the project.
 * @throws {@link HttpError} when Phoenix rejects the request, e.g. with a 404
 * if the project does not exist.
 *
 * @requires Phoenix server >= 17.16.0
 *
 * @example
 * ```ts
 * import { listProjectAnnotationConfigs } from "@arizeai/phoenix-client/projects";
 *
 * const configs = await listProjectAnnotationConfigs({
 *   projectName: "support-bot",
 * });
 *
 * for (const config of configs) {
 *   console.log(`${config.name} (${config.type})`);
 * }
 * ```
 */
export async function listProjectAnnotationConfigs(
  params: ListProjectAnnotationConfigsParams
): Promise<AnnotationConfig[]> {
  const client = params.client ?? createClient();
  await ensureServerCapability({
    client,
    requirement: LIST_PROJECT_ANNOTATION_CONFIGS,
  });
  const projectIdentifier = resolveProjectIdentifier(params);

  const configs: AnnotationConfig[] = [];
  let cursor: string | null = null;

  do {
    const response: {
      data?: ProjectAnnotationConfigsResponse;
      error?: unknown;
    } = await client.GET(
      "/v1/projects/{project_identifier}/annotation_configs",
      {
        params: {
          path: { project_identifier: projectIdentifier },
          query: { cursor, limit: DEFAULT_PAGE_SIZE },
        },
      }
    );

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list project annotation configs");

    cursor = response.data.next_cursor ?? null;
    configs.push(...response.data.data);
  } while (cursor != null);

  return configs;
}
