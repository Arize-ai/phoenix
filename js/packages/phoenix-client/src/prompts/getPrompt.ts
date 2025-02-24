import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { PromptSelector, PromptVersion } from "../types/prompts";
import { getPromptBySelector } from "../utils/getPromptBySelector";

/**
 * Parameters for getting a prompt from Phoenix.
 */
export interface GetPromptParams extends ClientFn {
  /**
   * The prompt to get. Can be in the form of a prompt id, a prompt version id, a prompt name, or a prompt name + tag.
   */
  prompt: PromptSelector;
}

/**
 * Get a prompt from the Phoenix API.
 *
 * @param params - The parameters to get a prompt.
 * @returns The prompt version, or null if it does not exist.
 */
export async function getPrompt({
  client: _client,
  prompt: _prompt,
}: GetPromptParams): Promise<PromptVersion | null> {
  const client = _client ?? createClient();
  const promptVersion = await getPromptBySelector({ client, prompt: _prompt });
  return promptVersion;
}
