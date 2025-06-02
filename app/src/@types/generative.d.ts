// TODO: Pull from GenerativeProviderKey in gql schema
declare type ModelProvider =
  | "OPENAI"
  | "AZURE_OPENAI"
  | "ANTHROPIC"
  | "GOOGLE"
  | "DEEPSEEK"
  | "XAI";

/**
 * The role of a chat message
 */
declare type ChatMessageRole = "user" | "system" | "ai" | "tool";

/**
 * The tool picking mechanism for an LLM
 * Either "auto", "required", "none", or a specific tool
 * @see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
 */
declare type ToolChoice =
  | "auto"
  | "required"
  | "none"
  | { type: "function"; function: { name: string } };
