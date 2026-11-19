import { createClient } from "../client";
import { DELETE_PROMPT } from "../constants/serverRequirements";
import { HttpError } from "../errors";
import type { ClientFn } from "../types/core";
import type { PromptIdentifier } from "../types/prompts";
import { resolvePromptIdentifier } from "../utils/resolvePromptIdentifier";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting a prompt.
 */
export interface DeletePromptParams extends ClientFn {
  /**
   * The prompt to delete. Selected either by `name` or by `promptId` — the same
   * selector style {@link getPrompt} takes, minus the version-level selectors,
   * which do not identify a prompt.
   */
  prompt: PromptIdentifier;
}

/**
 * Delete a prompt via `DELETE /v1/prompts/{prompt_identifier}`.
 *
 * Deletion cascades: every version of the prompt, along with its version tags
 * and labels, is removed with it. This cannot be undone.
 *
 * @param params - The parameters to delete the prompt.
 * @param params.prompt - The prompt to delete, selected by `name` or `promptId`.
 * @returns A promise that resolves once the prompt is deleted.
 * @throws An error if the prompt does not exist, or if the deletion fails.
 *
 * @requires Phoenix server >= 13.20.0
 *
 * @example
 * ```ts
 * import { deletePrompt } from "@arizeai/phoenix-client/prompts";
 *
 * // Delete by name
 * await deletePrompt({ prompt: { name: "my-prompt" } });
 *
 * // Delete by prompt id
 * await deletePrompt({ prompt: { promptId: "UHJvbXB0OjE=" } });
 * ```
 */
export async function deletePrompt({
  client: _client,
  prompt,
}: DeletePromptParams): Promise<void> {
  const promptIdentifier = resolvePromptIdentifier(prompt);

  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: DELETE_PROMPT });

  try {
    await client.DELETE("/v1/prompts/{prompt_identifier}", {
      params: {
        path: {
          prompt_identifier: promptIdentifier,
        },
      },
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new Error(`Prompt not found: ${promptIdentifier}`, {
        cause: error,
      });
    }
    throw error;
  }
}
