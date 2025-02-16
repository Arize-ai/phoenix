import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { PromptVersion } from "../types/prompts";

/**
 * Parameters to crate a prompt
 */
export interface CreatePromptParams extends ClientFn {
  /**
   * The name of the promt
   */
  name: string;
  /**
   * The description of the prompt
   */
  description?: string;
  /**
   * The prompt version to push onto the history of the promt
   */
  version: PromptVersion;
}

/**
 * Create a prompt and store it in Phoenix
 * If a prompt with the same name exists, a new version of the prompt will be appended to the history
 */
export async function createPrompt({
  client: _client,
  version,
  ...promptParams
}: CreatePromptParams): Promise<PromptVersion> {
  const client = _client ?? createClient();
  const prompt = await createPrompt({ client, prompt: _prompt });
  return prompt;
}
