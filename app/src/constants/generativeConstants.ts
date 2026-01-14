/**
 * A mapping of ModelProvider to a human-readable string
 */
export const ModelProviders: Record<ModelProvider, string> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
  GOOGLE: "Google",
  DEEPSEEK: "DeepSeek",
  XAI: "xAI",
  OLLAMA: "Ollama",
  AWS: "AWS Bedrock",
};

/**
 * The default model provider
 */
export const DEFAULT_MODEL_PROVIDER: ModelProvider = "OPENAI";
/**
 * The default model name
 */
export const DEFAULT_MODEL_NAME = "gpt-4o";

export const DEFAULT_CHAT_ROLE: ChatMessageRole = "user";

/**
 * Map of {@link ChatMessageRole} to potential role values.
 * Used to map roles to a canonical role.
 */
export const ChatRoleMap: Record<ChatMessageRole, string[]> = {
  user: ["user", "human"],
  // Assistant used by OpenAI
  // Model used by Gemini
  ai: ["assistant", "bot", "ai", "model"],
  // Developer is a newer tier of role from OpenAI
  // While not 1 to 1 with system, it's a close match and so we treat it as such
  system: ["system", "developer"],
  tool: ["tool"],
};

/**
 * A mapping of model providers to the credentials configs that are required for secure access.
 * In most cases, there is only one credential name per provider, but some providers require multiple credentials.
 */
export const ProviderToCredentialsConfigMap: Record<
  ModelProvider,
  ModelProviderCredentialConfig[]
> = {
  OPENAI: [{ envVarName: "OPENAI_API_KEY", isRequired: true }],
  AZURE_OPENAI: [{ envVarName: "AZURE_OPENAI_API_KEY", isRequired: true }],
  ANTHROPIC: [{ envVarName: "ANTHROPIC_API_KEY", isRequired: true }],
  GOOGLE: [{ envVarName: "GEMINI_API_KEY", isRequired: true }],
  DEEPSEEK: [{ envVarName: "DEEPSEEK_API_KEY", isRequired: true }],
  XAI: [{ envVarName: "XAI_API_KEY", isRequired: true }],
  OLLAMA: [],
  AWS: [
    { envVarName: "AWS_ACCESS_KEY_ID", isRequired: true },
    { envVarName: "AWS_SECRET_ACCESS_KEY", isRequired: true },
    { envVarName: "AWS_SESSION_TOKEN", isRequired: false },
  ],
} as const;

// =============================================================================
// SDK Configuration (for Custom Providers)
// =============================================================================
/**
 * SDK types for generative model providers.
 * This mirrors the GraphQL GenerativeModelSDK enum.
 */
export type GenerativeModelSDK =
  | "OPENAI"
  | "AZURE_OPENAI"
  | "ANTHROPIC"
  | "AWS_BEDROCK"
  | "GOOGLE_GENAI";

/**
 * Azure authentication method types.
 */
export type AzureAuthMethod = "api_key" | "ad_token_provider" | "environment";

/**
 * AWS Bedrock authentication method types.
 */
export type AWSAuthMethod = "access_keys" | "environment";

/**
 * Mapping from SDK enum to ModelProvider key.
 * Used for resolving provider icons and display names.
 * TypeScript enforces that all SDK values are mapped.
 */
export const SDK_TO_PROVIDER_MAP: Readonly<
  Record<GenerativeModelSDK, ModelProvider>
> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
} as const;

/**
 * Mapping from normalized provider strings to ModelProvider keys.
 * Used for resolving provider icons when the provider string is known.
 * Keys should be lowercase, normalized versions of provider names.
 */
export const STRING_TO_PROVIDER_MAP: Readonly<Record<string, ModelProvider>> = {
  openai: "OPENAI",
  azure: "AZURE_OPENAI",
  anthropic: "ANTHROPIC",
  aws: "AWS",
  google: "GOOGLE",
  xai: "XAI",
  ollama: "OLLAMA",
  deepseek: "DEEPSEEK",
} as const;

/**
 * Human-readable labels for each SDK type.
 * Used in the SDK selector dropdown.
 */
export const SDK_LABELS: Readonly<Record<GenerativeModelSDK, string>> = {
  OPENAI: "OpenAI",
  AZURE_OPENAI: "Azure OpenAI",
  ANTHROPIC: "Anthropic",
  AWS_BEDROCK: "AWS Bedrock",
  GOOGLE_GENAI: "Google GenAI",
} as const;

/**
 * SDK options for select dropdowns.
 * Derived from SDK_LABELS to ensure consistency.
 */
export const SDK_OPTIONS: ReadonlyArray<{
  id: GenerativeModelSDK;
  label: string;
}> = (Object.entries(SDK_LABELS) as Array<[GenerativeModelSDK, string]>).map(
  ([id, label]) => ({ id, label })
);

/**
 * Default provider string values for each SDK type.
 * These provide sensible defaults that match common usage patterns.
 */
export const SDK_DEFAULT_PROVIDER: Readonly<
  Record<GenerativeModelSDK, string>
> = {
  OPENAI: "openai",
  AZURE_OPENAI: "azure",
  ANTHROPIC: "anthropic",
  AWS_BEDROCK: "aws",
  GOOGLE_GENAI: "google",
} as const;

/**
 * Human-readable labels for Azure authentication methods.
 */
const AZURE_AUTH_METHOD_LABELS: Readonly<Record<AzureAuthMethod, string>> = {
  api_key: "API Key",
  ad_token_provider: "Azure AD Token Provider",
  environment: "Default Credentials (Managed Identity)",
} as const;

/**
 * Azure auth method options for select dropdowns.
 */
export const AZURE_AUTH_METHOD_OPTIONS: ReadonlyArray<{
  id: AzureAuthMethod;
  label: string;
}> = (
  Object.entries(AZURE_AUTH_METHOD_LABELS) as Array<[AzureAuthMethod, string]>
).map(([id, label]) => ({ id, label }));

/**
 * Human-readable labels for AWS Bedrock authentication methods.
 */
const AWS_AUTH_METHOD_LABELS: Readonly<Record<AWSAuthMethod, string>> = {
  environment: "Default Credentials (IAM Role)",
  access_keys: "Access Keys",
} as const;

/**
 * AWS Bedrock auth method options for select dropdowns.
 */
export const AWS_AUTH_METHOD_OPTIONS: ReadonlyArray<{
  id: AWSAuthMethod;
  label: string;
}> = (
  Object.entries(AWS_AUTH_METHOD_LABELS) as Array<[AWSAuthMethod, string]>
).map(([id, label]) => ({ id, label }));
