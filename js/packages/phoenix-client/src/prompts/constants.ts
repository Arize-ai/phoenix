import type { PromptModelProvider } from "../types/prompts";

/**
 * A mapping of PromptModelProvider to a human-readable string
 */
export const PromptModelProviders: Record<PromptModelProvider, string> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
  GOOGLE: "Google",
  DEEPSEEK: "DeepSeek",
  XAI: "xAI",
  OLLAMA: "Ollama",
  AWS: "AWS Bedrock",
};
