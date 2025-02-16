import { createClient } from "../client";
import { ClientFn } from "../types/core";
import { PromptData, PromptVersionData, PromptVersion } from "../types/prompts";

/**
 * Parameters to crate a prompt
 */
export interface CreatePromptParams extends ClientFn, PromptData {
  /**
   * The name of the promt
   */
  name: string;
  /**
   * The description of the prompt
   */
  description?: string;
  /**
   * The prompt version to push onto the history of the prompt
   */
  version: PromptVersionData;
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
  const response = await client.POST("/v1/prompts", {
    body: {
      prompt: promptParams,
      version: version,
    },
  });
  const createdPromptVersion = response.data?.data;
  if (!createdPromptVersion) {
    throw new Error("Failed to create prompt");
  }
  return createdPromptVersion;
}
