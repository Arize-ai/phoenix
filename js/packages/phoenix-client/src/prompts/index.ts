import { createClient } from "../client";
import { ClientFn } from "../types/core";

interface GetPromptById {
  promptId: string;
}

interface GetPromptByName {
  name: string;
}

interface GetPromptByVersion {
  versionId: string;
}

interface GetPromptByTag {
  tag: string;
}
export interface GetPromptParams extends ClientFn {
  prompt: GetPromptById | GetPromptByName | GetPromptByVersion | GetPromptByTag;
}
export function getPrompt({ client: _client, prompt }: GetPromptParams) {
  const client = _client ?? createClient();
  // TODO: Implement
}
