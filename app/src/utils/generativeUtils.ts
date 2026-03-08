import { LLMProvider } from "@arizeai/openinference-semantic-conventions";

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
    provider === "AWS" ||
    provider === "CEREBRAS" ||
    provider === "FIREWORKS" ||
    provider === "GROQ" ||
    provider === "MOONSHOT" ||
    provider === "PERPLEXITY" ||
    provider === "TOGETHER"
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
    case "AWS":
      return "AWS";
    case "CEREBRAS":
      return "Cerebras";
    case "FIREWORKS":
      return "Fireworks";
    case "GROQ":
      return "Groq";
    case "MOONSHOT":
      return "Moonshot";
    case "PERPLEXITY":
      return "Perplexity";
    case "TOGETHER":
      return "Together";
    default:
      assertUnreachable(provider);
  }
}

/**
 * Translates the model provider to the semantic convention LLM provider
 * @param provider - The provider key
 * @returns The equivalent LLM provider in semantic conventions
 */
export function getSemConvProvider(provider: ModelProvider): string {
  switch (provider) {
    case "OPENAI":
      return LLMProvider.OPENAI.toString();
    case "AZURE_OPENAI":
      return LLMProvider.AZURE.toString();
    case "ANTHROPIC":
      return LLMProvider.ANTHROPIC.toString();
    case "GOOGLE":
      return LLMProvider.GOOGLE.toString();
    case "AWS":
      return LLMProvider.AWS.toString();
    case "DEEPSEEK":
      return "deepseek"; // TODO: Add support for DeepSeek to semantic conventions
    case "XAI":
      return "xai"; // TODO: Add support for XAI to semantic conventions
    case "OLLAMA":
      throw new Error(`Ollama is not supported`);
    case "CEREBRAS":
      return "cerebras"; // TODO: Add support for Cerebras to semantic conventions
    case "FIREWORKS":
      return "fireworks"; // TODO: Add support for Fireworks to semantic conventions
    case "GROQ":
      return "groq"; // TODO: Add support for Groq to semantic conventions
    case "MOONSHOT":
      return "moonshot"; // TODO: Add support for Moonshot to semantic conventions
    case "PERPLEXITY":
      return "perplexity"; // TODO: Add support for Perplexity to semantic conventions
    case "TOGETHER":
      return "together"; // TODO: Add support for Together to semantic conventions
    default:
      assertUnreachable(provider);
  }
}
