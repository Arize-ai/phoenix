import { LlmProvider } from "./types";

export const ProviderToCredentialDisplayMap: Record<LlmProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  azureOpenAi: "AZURE_OPENAI_API_KEY",
};
