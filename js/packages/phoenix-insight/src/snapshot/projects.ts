import type { PhoenixClient } from "@arizeai/phoenix-client";
import type { ExecutionMode } from "../modes/types.js";
import { withErrorHandling } from "./client.js";

/**
 * Converts an array of items to JSONL format (one JSON object per line)
 */
function toJSONL(items: unknown[]): string {
  return items.map((item) => JSON.stringify(item)).join("\n");
}

/**
 * Fetches all projects and writes them to the filesystem
 * @param client - The Phoenix client instance
 * @param mode - The execution mode (sandbox or local)
 */
export async function fetchProjects(
  client: PhoenixClient,
  mode: ExecutionMode
): Promise<void> {
  // Fetch all projects with error handling
  const projectsData = await withErrorHandling(async () => {
    const response = await client.GET("/v1/projects", {
      params: {
        query: {
          include_experiment_projects: false,
        },
      },
    });

    if (!response.data) {
      throw new Error("No data returned from projects endpoint");
    }

    return response.data;
  }, "fetching projects");

  // Extract projects from the response
  const projects = projectsData.data || [];

  // Write projects list as JSONL to /phoenix/projects/index.jsonl
  const projectsPath = "/phoenix/projects/index.jsonl";
  await mode.writeFile(projectsPath, toJSONL(projects));

  // For each project, create a metadata.json file
  for (const project of projects) {
    const projectDir = `/phoenix/projects/${project.name}`;
    const metadataPath = `${projectDir}/metadata.json`;

    // Write project metadata
    await mode.writeFile(metadataPath, JSON.stringify(project, null, 2));

    // Create empty spans directory (will be populated by snapshot-spans task)
    const spansDir = `${projectDir}/spans`;
    // Create directory by writing a placeholder that will be overwritten later
    await mode.writeFile(`${spansDir}/.gitkeep`, "");
  }
}
