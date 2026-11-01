import type { GetPromptByVersionSelector } from "../types/prompts";

/**
 * Resolve a version selector to the `{prompt_version_id}` path segment used by
 * the Phoenix REST API.
 *
 * @param prompt - The prompt, selected by version ID.
 * @returns The prompt version ID to interpolate into the request path.
 * @throws An error if the selector does not contain a non-empty version ID.
 */
export function resolvePromptVersionId(
  prompt: GetPromptByVersionSelector
): string {
  if (!prompt.versionId) {
    throw new Error("versionId must be a non-empty prompt version id.");
  }
  return prompt.versionId;
}
