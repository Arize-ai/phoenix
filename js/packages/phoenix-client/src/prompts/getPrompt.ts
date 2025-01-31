import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { PromptLike, PromptVersion } from "../types/prompts";
import { getPromptVersionLike } from "../utils/getPromptVersionLike";

/**
 * Parameters for the getPrompt function
 */
export interface GetPromptParams extends ClientFn {
  prompt: PromptLike;
}

/**
 * Get a prompt from the Phoenix API.
 */
export async function getPrompt({
  client: _client,
  prompt: _prompt,
}: GetPromptParams): Promise<PromptVersion> {
  const client = _client ?? createClient();
  const promptVersion = await getPromptVersionLike({ client, prompt: _prompt });
  return promptVersion;
}
