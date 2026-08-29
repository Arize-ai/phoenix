import { createClient } from "../client";
import { DELETE_PROMPT } from "../constants/serverRequirements";
import { HttpError } from "../errors";
import type { ClientFn } from "../types/core";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for deleting a prompt.
 */
export interface DeletePromptParams extends ClientFn {
  /**
   * The prompt name or ID (a Phoenix Global ID, base64-encoded).
   */
  promptIdentifier: string;
}

/**
 * Delete a prompt via `DELETE /v1/prompts/{prompt_identifier}`.
 *
 * Deletion cascades: every version of the prompt, along with its version tags
 * and labels, is removed with it. This cannot be undone.
 *
 * @param params - The parameters to delete the prompt.
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
 * await deletePrompt({ promptIdentifier: "my-prompt" });
 *
 * // Delete by Global ID
 * await deletePrompt({ promptIdentifier: "UHJvbXB0OjE=" });
 * ```
 */
export async function deletePrompt({
  client: _client,
  promptIdentifier,
}: DeletePromptParams): Promise<void> {
  if (!promptIdentifier) {
    throw new Error("promptIdentifier must be a non-empty prompt name or ID.");
  }

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
