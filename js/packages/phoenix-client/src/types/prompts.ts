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

/**
 * A prompt like object.
 *
 * Can be a prompt id, a prompt name, a prompt version id, or a prompt name + tag.
 */
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
 * The Phoenix prompt tool type from the API.
 */
export type PromptTool =
  components["schemas"]["PromptToolsV1"]["tools"][number];

/**
 * The Phoenix prompt tool choice type from the API.
 */
export type PromptToolChoice = NonNullable<
  components["schemas"]["PromptToolsV1"]["tool_choice"]
>;
/**
 * The Phoenix prompt output schema type from the API.
 */
export type PromptResponseFormat =
  components["schemas"]["PromptResponseFormatJSONSchema"];

/**
 * The prompt type from the API.
 */
export type Prompt = components["schemas"]["Prompt"];
