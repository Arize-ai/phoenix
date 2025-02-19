import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { PromptSelector, PromptVersion } from "../types/prompts";
import { getPromptBySelector } from "../utils/getPromptVersionLike";

/**
 * Parameters for the getPrompt function
 */
export interface GetPromptParams extends ClientFn {
  /**
   * The prompt to get. Can be in the form of a prompt id, a prompt version id, a prompt name, or a prompt name + tag.
   */
  prompt: PromptSelector;
}

/**
 * Get a prompt from the Phoenix API.
 */
export async function getPrompt({
  client: _client,
  prompt: _prompt,
}: GetPromptParams): Promise<PromptVersion | null> {
  const client = _client ?? createClient();
  const promptVersion = await getPromptBySelector({ client, prompt: _prompt });
  return promptVersion;
}
