import invariant from "tiny-invariant";

import type { components } from "../__generated__/api/v1";
import { createClient } from "../client";
import type { ClientFn } from "../types/core";
import type { Project } from "../types/projects";

export interface GetProjectsParams extends ClientFn {
  /**
   * Return only projects whose name contains this substring
   * (case-insensitive). The match is performed server-side.
   *
   * @requires Phoenix server >= 17.16.0
   */
  nameContains?: string | null;
}

type ProjectsResponse = components["schemas"]["GetProjectsResponseBody"];

const DEFAULT_PAGE_SIZE = 100;

/**
 * List projects with automatic pagination handling.
 *
 * @example
 * ```ts
 * import { getProjects } from "@arizeai/phoenix-client/projects";
 *
 * // Every project
 * const projects = await getProjects();
 *
 * // Only projects whose name contains "agent" (requires Phoenix server >= 17.16.0)
 * const agentProjects = await getProjects({ nameContains: "agent" });
 *
 * for (const project of agentProjects) {
 *   console.log(`Project: ${project.name} (${project.id})`);
 * }
 * ```
 */
export async function getProjects(
  params: GetProjectsParams = {}
): Promise<Project[]> {
  const client = params.client || createClient();
  const { nameContains } = params;

  const projects: Project[] = [];
  let cursor: string | null | undefined = null;

  do {
    const response: { data?: ProjectsResponse; error?: unknown } =
      await client.GET("/v1/projects", {
        params: {
          query: {
            cursor,
            limit: DEFAULT_PAGE_SIZE,
            name_contains: nameContains,
          },
        },
      });

    if (response.error) throw response.error;
    invariant(response.data?.data, "Failed to list projects");

    cursor = response.data.next_cursor ?? null;
    projects.push(...response.data.data);
  } while (cursor != null);

  return projects;
}
