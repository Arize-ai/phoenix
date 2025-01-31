/**
 * Supported model providers
 */
export type PhoenixModelProvider =
  | "OPENAI"
  | "AZURE_OPENAI"
  | "ANTHROPIC"
  | "GEMINI";

/**
 * The role of a chat message
 */
export type PhoenixChatMessageRole = "user" | "system" | "ai" | "tool";

/**
 * A mapping of ModelProvider to a human-readable string
 */
export const PhoenixModelProviders: Record<PhoenixModelProvider, string> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Gemini",
};

/**
 * The default model provider
 */
export const DEFAULT_MODEL_PROVIDER: PhoenixModelProvider = "OPENAI";

/**
 * The default model name
 */
export const DEFAULT_MODEL_NAME = "gpt-4o";

/**
 * The default chat role
 */
export const DEFAULT_CHAT_ROLE: PhoenixChatMessageRole = "user";
