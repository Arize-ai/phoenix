import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * A TypeGuard to ensure that a string is a valid ModelProvider
 */
export function isModelProvider(provider: string): provider is ModelProvider {
  return (
    provider === "OPENAI" ||
    provider === "AZURE_OPENAI" ||
    provider === "ANTHROPIC" ||
    provider === "GOOGLE" ||
    provider === "DEEPSEEK" ||
    provider === "XAI" ||
    provider === "OLLAMA" ||
    provider === "BEDROCK" ||
    provider === "AWS"
  );
}

export function getProviderName(provider: ModelProvider): string {
  switch (provider) {
    case "OPENAI":
      return "OpenAI";
    case "AZURE_OPENAI":
      return "Azure OpenAI";
    case "ANTHROPIC":
      return "Anthropic";
    case "GOOGLE":
      return "Google";
    case "DEEPSEEK":
      return "DeepSeek";
    case "XAI":
      return "XAI";
    case "OLLAMA":
      return "Ollama";
    case "BEDROCK":
      return "Bedrock";
    case "AWS":
      return "AWS";
    default:
      assertUnreachable(provider);
  }
}
