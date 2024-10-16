/**
 * A mapping of ModelProvider to a human-readable string
 */
export const ModelProviders: Record<ModelProvider, string> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
};

/**
 * The default model provider
 */
export const DEFAULT_MODEL_PROVIDER: ModelProvider = "OPENAI";

export const DEFAULT_CHAT_ROLE: ChatMessageRole = "user";
