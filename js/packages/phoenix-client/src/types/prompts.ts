import { components } from "../__generated__/api/v1";

/**
 * Supported prompt model providers
 */
export type PromptModelProvider =
  | "OPENAI"
  | "AZURE_OPENAI"
  | "ANTHROPIC"
  | "GEMINI";

/**
 * The role of a prompt chat message
 */
export type PromptChatMessageRole = "user" | "system" | "ai" | "tool";

/**
 * Selector for a prompt by id.
 */
export interface GetPromptByIdSelector {
  promptId: string;
}

/**
 * Selector for a prompt by name.
 */
export interface GetPromptByNameSelector {
  name: string;
}

/**
 * Selector for a prompt by version id.
 */
export interface GetPromptByVersionSelector {
  versionId: string;
}

/**
 * Selector for a named prompt by tag.
 */
export interface GetPromptByTagSelector {
  tag: string;
  name: string;
}

/**
 * A prompt like object.
 *
 * Can be a prompt id, a prompt name, a prompt version id, or a prompt name + tag.
 */
export type PromptSelector =
  | GetPromptByIdSelector
  | GetPromptByNameSelector
  | GetPromptByVersionSelector
  | GetPromptByTagSelector;

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
export type PromptTool = components["schemas"]["PromptTools"]["tools"][number];

/**
 * The Phoenix prompt tool choice type from the API.
 */
export type PromptToolChoice = NonNullable<
  components["schemas"]["PromptTools"]["tool_choice"]
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
