/**
 * Constants for Custom Provider Configuration
 *
 * This module centralizes SDK-related constants used across the custom provider
 * form components. Keeping these in one place ensures consistency and makes
 * it easier to add new SDK types in the future.
 */

import type { GenerativeModelSDK } from "./__generated__/CustomProvidersCard_data.graphql";
import type { AzureAuthMethod } from "./CustomProviderForm";

// =============================================================================
// SDK to ModelProvider Mappings
// =============================================================================

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

// =============================================================================
// SDK Configuration
// =============================================================================

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

// =============================================================================
// Azure Authentication Configuration
// =============================================================================

/**
 * Human-readable labels for Azure authentication methods.
 */
export const AUTH_METHOD_LABELS: Readonly<Record<AzureAuthMethod, string>> = {
  api_key: "API Key",
  ad_token_provider: "Azure AD Token Provider",
} as const;

/**
 * Azure auth method options for select dropdowns.
 */
export const AUTH_METHOD_OPTIONS: ReadonlyArray<{
  id: AzureAuthMethod;
  label: string;
}> = (
  Object.entries(AUTH_METHOD_LABELS) as Array<[AzureAuthMethod, string]>
).map(([id, label]) => ({ id, label }));
