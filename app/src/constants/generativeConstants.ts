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

/**
 * Some of the api versions for Azure OpenAI
 * Taken from @see https://github.com/Azure/azure-rest-api-specs/tree/main/specification/cognitiveservices/data-plane/AzureOpenAI/inference
 *
 * Which links from the data plane inference section here: @see https://learn.microsoft.com/en-us/azure/ai-services/openai/reference?WT.mc_id=AZ-MVP-5004796
 * Only api versions taken from 2023 onwards are included
 */
export const AZURE_OPENAI_API_VERSIONS = [
  "2024-10-01-preview",
  "2024-09-01-preview",
  "2024-08-01-preview",
  "2024-07-01-preview",
  "2024-06-01",
  "2024-05-01-preview",
  "2024-04-01-preview",
  "2024-03-01-preview",
  "2024-02-15-preview",
  "2024-02-01",
  "2023-10-01-preview",
  "2023-09-01-preview",
  "2023-08-01-preview",
  "2023-07-01-preview",
  "2023-06-01-preview",
  "2023-05-15",
  "2023-03-15-preview",
];
