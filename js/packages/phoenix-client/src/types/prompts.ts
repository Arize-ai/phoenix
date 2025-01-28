import { components } from "../__generated__/api/v1";

export interface GetPromptById {
  promptId: string;
}

export interface GetPromptByName {
  name: string;
}

export interface GetPromptByVersion {
  versionId: string;
}

export interface GetPromptByTag {
  tag: string;
  name: string;
}

export type PromptLike =
  | GetPromptById
  | GetPromptByName
  | GetPromptByVersion
  | GetPromptByTag;

/**
 * The prompt version type from the API.
 *
 * aka the prompt at a specific point in time
 */
export type PromptVersion = components["schemas"]["PromptVersion"];

/**
 * The format of the prompt template message(s).
 */
export type PromptTemplateFormat = PromptVersion["template_format"];

/**
 * Extracts the chat message type from the prompt template who may be a StringTemplate or ChatTemplate.
 */
export type PromptChatMessage = Extract<
  PromptVersion["template"],
  { messages: unknown[] }
>["messages"][number];

/**
 * The prompt type from the API.
 */
export type Prompt = components["schemas"]["Prompt"];
