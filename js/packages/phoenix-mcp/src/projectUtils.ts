/**
 * Resolve the project identifier for a project-scoped MCP tool.
 *
 * Precedence is:
 * 1. Explicit `projectIdentifier`
 * 2. Legacy `projectName`
 * 3. Configured default project from `PHOENIX_PROJECT` or `--project`
 */
export function resolveProjectIdentifier({
  projectIdentifier,
  legacyProjectIdentifier,
  defaultProjectIdentifier,
}: {
  projectIdentifier?: string;
  legacyProjectIdentifier?: string;
  defaultProjectIdentifier?: string;
}): string {
  const normalizedProjectIdentifier =
    projectIdentifier?.trim() ||
    legacyProjectIdentifier?.trim() ||
    defaultProjectIdentifier?.trim();

  if (!normalizedProjectIdentifier) {
    throw new Error(
      "projectIdentifier is required. Pass projectIdentifier or configure PHOENIX_PROJECT/--project."
    );
  }

  return normalizedProjectIdentifier;
}
