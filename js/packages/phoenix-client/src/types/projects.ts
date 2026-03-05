/**
 * Identifies a project. Accepts any of:
 * - `project` — a project ID or name (the server accepts either)
 * - `projectId` — an explicit project ID
 * - `projectName` — an explicit project name
 */
export type ProjectIdentifier =
  | { project: string }
  | { projectId: string }
  | { projectName: string };

/**
 * Resolves a {@link ProjectIdentifier} union to a plain string
 * suitable for the REST `project_identifier` path parameter.
 */
export function resolveProjectIdentifier(
  identifier: ProjectIdentifier
): string {
  if ("project" in identifier) return identifier.project;
  if ("projectId" in identifier) return identifier.projectId;
  return identifier.projectName;
}
