import type { PromptIdentifier } from "../types/prompts";

/**
 * Resolve a prompt-level selector to the `{prompt_identifier}` path segment the
 * Phoenix REST API expects.
 *
 * Version-level selectors are rejected rather than silently widened: structural
 * typing lets a `{ name, tag }` or `{ versionId }` value reach a
 * {@link PromptIdentifier} parameter, and quietly dropping the version would
 * point the caller at the whole prompt instead of the version they named.
 *
 * @param prompt - the prompt, selected by `name` or by `promptId`
 * @returns The identifier to interpolate into the request path.
 * @throws An error if the selector is empty, or selects a version rather than a
 * prompt.
 */
export function resolvePromptIdentifier(prompt: PromptIdentifier): string {
  if ("versionId" in prompt) {
    throw new Error(
      "A prompt version id selects a single version, not a prompt. Select the prompt by name or promptId."
    );
  }
  if ("tag" in prompt) {
    throw new Error(
      "A tag selects a single version, not a prompt. Select the prompt by name or promptId."
    );
  }
  if ("promptId" in prompt) {
    if (!prompt.promptId) {
      throw new Error("promptId must be a non-empty prompt id.");
    }
    return prompt.promptId;
  }
  if ("name" in prompt) {
    if (!prompt.name) {
      throw new Error("name must be a non-empty prompt name.");
    }
    return prompt.name;
  }
  throw new Error("A prompt must be selected by either name or promptId.");
}
