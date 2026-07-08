/**
 * Resolve the project identifier for a project-scoped MCP tool.
 *
 * Precedence:
 * 1. Explicit `projectIdentifier` from the tool call
 * 2. Configured default from `PHOENIX_PROJECT` env var or `--project` CLI flag
 */
export function resolveProjectIdentifier({
  projectIdentifier,
  defaultProjectIdentifier,
}: {
  projectIdentifier?: string;
  defaultProjectIdentifier?: string;
}): string {
  const resolved =
    projectIdentifier?.trim() || defaultProjectIdentifier?.trim();

  if (!resolved) {
    throw new Error(
      "projectIdentifier is required. Pass projectIdentifier or configure PHOENIX_PROJECT/--project."
    );
  }

  return resolved;
}
