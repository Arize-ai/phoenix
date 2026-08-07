import invariant from "tiny-invariant";

import { createClient } from "../client";
import { PATCH_PROMPT } from "../constants/serverRequirements";
import { HttpError } from "../errors";
import type { ClientFn } from "../types/core";
import type { Prompt } from "../types/prompts";
import { ensureServerCapability } from "../utils/serverVersionUtils";

/**
 * Parameters for updating a prompt's description and/or metadata.
 *
 * Omit a field to leave it unchanged. Pass `description: null` to clear the
 * description. `metadata` replaces the existing metadata object as a whole.
 */
export interface UpdatePromptParams extends ClientFn {
  /**
   * The prompt name or ID.
   */
  promptIdentifier: string;
  /**
   * New description for the prompt. Pass `null` to clear it. Omit to leave
   * unchanged.
   */
  description?: string | null;
  /**
   * New metadata object for the prompt (full replace). Omit to leave unchanged.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Update a prompt's description and/or metadata via
 * `PATCH /v1/prompts/{prompt_identifier}`.
 *
 * @param params - The parameters to update the prompt.
 * @returns The updated prompt.
 *
 * @requires Phoenix server >= 19.18.0
 *
 * @example
 * ```ts
 * import { updatePrompt } from "@arizeai/phoenix-client/prompts";
 *
 * const prompt = await updatePrompt({
 *   promptIdentifier: "my-prompt",
 *   description: "Production classifier",
 *   metadata: { team: "ml", env: "prod" },
 * });
 *
 * // Clear the description only
 * await updatePrompt({
 *   promptIdentifier: "my-prompt",
 *   description: null,
 * });
 * ```
 */
export async function updatePrompt({
  client: _client,
  promptIdentifier,
  description,
  metadata,
}: UpdatePromptParams): Promise<Prompt> {
  if (description === undefined && metadata === undefined) {
    throw new Error(
      "At least one of description or metadata must be provided."
    );
  }

  const client = _client ?? createClient();
  await ensureServerCapability({ client, requirement: PATCH_PROMPT });

  try {
    const response = await client.PATCH("/v1/prompts/{prompt_identifier}", {
      params: {
        path: {
          prompt_identifier: promptIdentifier,
        },
      },
      body: {
        ...(description !== undefined ? { description } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
    invariant(response.data?.data, "Failed to update prompt");
    return response.data.data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new Error(`Prompt not found: ${promptIdentifier}`, {
        cause: error,
      });
    }
    throw error;
  }
}
