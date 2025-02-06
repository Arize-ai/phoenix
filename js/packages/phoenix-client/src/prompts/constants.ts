import type { PromptModelProvider } from "../types/prompts";

/**
 * A mapping of ModelProvider to a human-readable string
 */
export const PromptModelProviders: Record<PromptModelProvider, string> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Gemini",
};
