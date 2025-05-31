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
    provider === "OLLAMA"
  );
}
