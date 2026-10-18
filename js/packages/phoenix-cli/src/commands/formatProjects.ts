import type { ProjectRetentionPolicyAssignment } from "@arizeai/phoenix-client/projects";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type ProjectLike = {
  id: string;
  name: string;
  description?: string | null;
};

export interface FormatProjectsOutputOptions {
  /**
   * Projects to format.
   */
  projects: ProjectLike[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatProjectsOutput({
  projects,
  format,
}: FormatProjectsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(projects);
  }
  if (selected === "json") {
    return JSON.stringify(projects, null, 2);
  }

  const rows = projects.map((p) => ({
    name: p.name,
    id: p.id,
    description: p.description ?? "",
  }));

  return formatTable(rows);
}

export interface FormatProjectRetentionOutputOptions {
  /**
   * The project's resulting retention-policy assignment.
   */
  assignment: ProjectRetentionPolicyAssignment;
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

/**
 * Format a retention-policy assignment. Pretty mode shows `(default)` when
 * the project falls back to the default policy (`policy_id: null`).
 */
export function formatProjectRetentionOutput({
  assignment,
  format,
}: FormatProjectRetentionOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(assignment);
  }
  if (selected === "json") {
    return JSON.stringify(assignment, null, 2);
  }

  return formatTable([
    {
      project_id: assignment.project_id,
      policy_id: assignment.policy_id ?? "(default)",
    },
  ]);
}
