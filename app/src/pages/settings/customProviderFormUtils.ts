/**
 * Custom Provider Form Data Utilities
 *
 * This module provides bidirectional data transformation between:
 * - Form data (flat structure with SDK-prefixed fields for react-hook-form)
 * - GraphQL data (nested structure matching the backend schema)
 *
 * ## Architecture Decisions
 *
 * ### Flat Form Fields with Prefixes
 * Form uses flat field names with SDK prefixes (e.g., `openai_api_key`, `azure_endpoint`)
 * rather than nested objects. This is intentional:
 * - Better compatibility with react-hook-form's validation and field registration
 * - Simpler Zod validation schemas with discriminated unions
 * - Explicit field names in JSX components for better readability
 * - Easier reset/clear logic when switching between SDK types
 *
 * ### Discriminated Unions
 * Both TypeScript types and the GraphQL schema use the `sdk` field as a discriminator,
 * enabling exhaustive type checking and safe narrowing.
 *
 * ### Data Flow
 * ```
 * GraphQL Response → transformConfigToFormValues() → Form State
 * Form State → buildClientConfig() → transformToCreateInput/PatchInput() → GraphQL Mutation
 * ```
 */

import type {
  CustomProvidersCard_data$data,
  GenerativeModelCustomProviderSDK,
} from "./__generated__/CustomProvidersCard_data.graphql";
import type { PatchGenerativeModelCustomProviderMutationInput } from "./__generated__/EditCustomProviderButtonPatchMutation.graphql";
import type { CreateGenerativeModelCustomProviderMutationInput } from "./__generated__/NewCustomProviderButtonCreateMutation.graphql";
import type {
  AnthropicFormData,
  AWSBedrockFormData,
  AzureOpenAIFormData,
  GoogleGenAIFormData,
  OpenAIFormData,
  ProviderFormData,
} from "./CustomProviderForm";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * GraphQL provider node type alias for better readability
 */
type ProviderNode =
  CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"];

/**
 * Result type for JSON parsing operations - follows Result pattern
 */
type JsonParseResult =
  | { success: true; data: Record<string, unknown> | unknown[] }
  | { success: false; error: string };

/**
 * Type for parsed JSON that can be an object (for headers)
 */
type JsonObject = Record<string, unknown>;

// =============================================================================
// Internal Utilities
// =============================================================================

/**
 * Removes null, undefined, empty strings, empty objects, and empty arrays from an object.
 * Returns undefined if the resulting object would be empty.
 *
 * Used to build compact GraphQL mutation inputs that only include defined values.
 *
 * @remarks
 * Uses `any` return type intentionally for GraphQL compatibility:
 * - GraphQL input types use strict non-null types for some fields
 * - TypeScript cannot verify runtime-populated values
 * - The GraphQL schema enforces required fields at the server layer
 * - Zod validation ensures required fields are present before submission
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compactObject<T extends Record<string, unknown>>(obj: T): any {
  const entries = Object.entries(obj).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (value === "") return false;
    if (typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).length > 0;
    }
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries);
}

/**
 * Parses a JSON string into an object or array.
 *
 * @throws {Error} If the string is not valid JSON or not an object/array
 * @returns undefined for empty/whitespace-only strings
 */
function parseJsonField(
  value: string | undefined
): JsonObject | unknown[] | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  const parsed: unknown = JSON.parse(value);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("JSON must be an object or array");
  }

  return parsed as JsonObject | unknown[];
}

/**
 * Serializes a value to a JSON string.
 *
 * @returns undefined for null/undefined values, or if serialization fails
 */
function serializeJsonField(value: unknown): string | undefined {
  if (value == null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

// =============================================================================
// Type Guards
// =============================================================================

function isOpenAIFormData(data: ProviderFormData): data is OpenAIFormData {
  return data.sdk === "OPENAI";
}

function isAzureOpenAIFormData(
  data: ProviderFormData
): data is AzureOpenAIFormData {
  return data.sdk === "AZURE_OPENAI";
}

function isAnthropicFormData(
  data: ProviderFormData
): data is AnthropicFormData {
  return data.sdk === "ANTHROPIC";
}

function isAWSBedrockFormData(
  data: ProviderFormData
): data is AWSBedrockFormData {
  return data.sdk === "AWS_BEDROCK";
}

function isGoogleGenAIFormData(
  data: ProviderFormData
): data is GoogleGenAIFormData {
  return data.sdk === "GOOGLE_GENAI";
}

// =============================================================================
// Form Default Values
// =============================================================================

/**
 * Creates type-safe default form values for a given SDK type.
 * Ensures all required fields are present with appropriate defaults.
 */
export function createDefaultFormData(
  sdk: GenerativeModelCustomProviderSDK
): ProviderFormData {
  const baseDefaults = {
    name: "",
    description: "",
  };

  switch (sdk) {
    case "OPENAI":
      return {
        ...baseDefaults,
        sdk: "OPENAI",
        provider: "",
        openai_api_key: "",
        openai_base_url: undefined,
        openai_organization: undefined,
        openai_project: undefined,
        openai_default_headers: undefined,
      } satisfies OpenAIFormData;

    case "AZURE_OPENAI":
      return {
        ...baseDefaults,
        sdk: "AZURE_OPENAI",
        provider: "",
        azure_endpoint: "",
        azure_deployment_name: "",
        azure_api_version: "",
        azure_auth_method: "api_key",
        azure_api_key: undefined,
        azure_tenant_id: undefined,
        azure_client_id: undefined,
        azure_client_secret: undefined,
        azure_scope: undefined,
        azure_default_headers: undefined,
      } satisfies AzureOpenAIFormData;

    case "ANTHROPIC":
      return {
        ...baseDefaults,
        sdk: "ANTHROPIC",
        provider: "",
        anthropic_api_key: "",
        anthropic_base_url: undefined,
        anthropic_default_headers: undefined,
      } satisfies AnthropicFormData;

    case "AWS_BEDROCK":
      return {
        ...baseDefaults,
        sdk: "AWS_BEDROCK",
        provider: "",
        aws_region: "",
        aws_access_key_id: "",
        aws_secret_access_key: "",
        aws_session_token: undefined,
        aws_endpoint_url: undefined,
      } satisfies AWSBedrockFormData;

    case "GOOGLE_GENAI":
      return {
        ...baseDefaults,
        sdk: "GOOGLE_GENAI",
        provider: "",
        google_api_key: "",
        google_base_url: undefined,
        google_headers: undefined,
      } satisfies GoogleGenAIFormData;

    default: {
      const _exhaustive: never = sdk;
      throw new Error(`Unknown SDK: ${String(_exhaustive)}`);
    }
  }
}

// =============================================================================
// JSON Validation (for form validation)
// =============================================================================

/**
 * Validates a JSON string without throwing.
 * Useful for form field validation.
 */
export function validateJsonField(value: string | undefined): JsonParseResult {
  if (!value || value.trim() === "") {
    return { success: true, data: {} };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return { success: false, error: "JSON must be an object or array" };
    }
    return { success: true, data: parsed as JsonObject | unknown[] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Invalid JSON: ${message}` };
  }
}

// =============================================================================
// GraphQL → Form Transformation
// =============================================================================

/**
 * Transforms a GraphQL provider node into form initial values.
 *
 * Uses the `sdk` field for type detection rather than inferring from config
 * properties, which is more robust for polymorphic types.
 */
export function transformConfigToFormValues(
  provider: ProviderNode
): Partial<ProviderFormData> {
  const baseValues = {
    name: provider.name,
    description: provider.description || "",
    provider: provider.provider,
  };

  const config = provider.config;
  const { sdk } = provider;

  switch (sdk) {
    case "OPENAI":
      return {
        ...baseValues,
        sdk: "OPENAI",
        openai_api_key: config?.openaiAuthenticationMethod?.apiKey || "",
        openai_base_url: config?.openaiClientKwargs?.baseUrl ?? undefined,
        openai_organization:
          config?.openaiClientKwargs?.organization ?? undefined,
        openai_project: config?.openaiClientKwargs?.project ?? undefined,
        openai_default_headers: serializeJsonField(
          config?.openaiClientKwargs?.defaultHeaders
        ),
      };

    case "AZURE_OPENAI": {
      const authMethod = config?.azureOpenaiAuthenticationMethod;
      const kwargs = config?.azureOpenaiClientKwargs;

      // Determine auth method based on which credentials are present
      const authMethodType: AzureOpenAIFormData["azure_auth_method"] =
        authMethod?.azureAdTokenProvider ? "ad_token_provider" : "api_key";

      return {
        ...baseValues,
        sdk: "AZURE_OPENAI",
        azure_endpoint: kwargs?.azureEndpoint ?? "",
        azure_deployment_name: kwargs?.azureDeployment ?? "",
        azure_api_version: kwargs?.apiVersion ?? "",
        azure_auth_method: authMethodType,
        azure_api_key: authMethod?.apiKey ?? undefined,
        azure_tenant_id:
          authMethod?.azureAdTokenProvider?.azureTenantId ?? undefined,
        azure_client_id:
          authMethod?.azureAdTokenProvider?.azureClientId ?? undefined,
        azure_client_secret:
          authMethod?.azureAdTokenProvider?.azureClientSecret ?? undefined,
        azure_scope: authMethod?.azureAdTokenProvider?.scope ?? undefined,
        azure_default_headers: serializeJsonField(kwargs?.defaultHeaders),
      };
    }

    case "ANTHROPIC":
      return {
        ...baseValues,
        sdk: "ANTHROPIC",
        anthropic_api_key: config?.anthropicAuthenticationMethod?.apiKey || "",
        anthropic_base_url: config?.anthropicClientKwargs?.baseUrl ?? undefined,
        anthropic_default_headers: serializeJsonField(
          config?.anthropicClientKwargs?.defaultHeaders
        ),
      };

    case "AWS_BEDROCK":
      return {
        ...baseValues,
        sdk: "AWS_BEDROCK",
        aws_region: config?.awsBedrockClientKwargs?.regionName || "",
        aws_access_key_id:
          config?.awsBedrockAuthenticationMethod?.awsAccessKeyId || "",
        aws_secret_access_key:
          config?.awsBedrockAuthenticationMethod?.awsSecretAccessKey || "",
        aws_session_token:
          config?.awsBedrockAuthenticationMethod?.awsSessionToken ?? undefined,
        aws_endpoint_url:
          config?.awsBedrockClientKwargs?.endpointUrl ?? undefined,
      };

    case "GOOGLE_GENAI": {
      const httpOptions = config?.googleGenaiClientKwargs?.httpOptions;
      return {
        ...baseValues,
        sdk: "GOOGLE_GENAI",
        google_api_key: config?.googleGenaiAuthenticationMethod?.apiKey || "",
        google_base_url: httpOptions?.baseUrl ?? undefined,
        google_headers: serializeJsonField(httpOptions?.headers),
      };
    }

    default:
      // Fallback for unknown SDK types
      return { ...baseValues, sdk: "OPENAI" };
  }
}

// =============================================================================
// Form → GraphQL Transformation
// =============================================================================

/**
 * Builds the nested clientConfig structure for GraphQL mutations.
 *
 * This transforms flat form fields into the nested structure expected by
 * the GraphQL schema. Uses type guards for safe type narrowing.
 */
export function buildClientConfig(formData: ProviderFormData) {
  if (isOpenAIFormData(formData)) {
    return {
      openai: {
        openaiAuthenticationMethod: {
          apiKey: formData.openai_api_key,
        },
        openaiClientKwargs: compactObject({
          baseUrl: formData.openai_base_url,
          organization: formData.openai_organization,
          project: formData.openai_project,
          defaultHeaders: parseJsonField(formData.openai_default_headers),
        }),
      },
    };
  }

  if (isAzureOpenAIFormData(formData)) {
    const authMethodType = formData.azure_auth_method || "api_key";

    // Build auth method based on selected type
    const authMethod =
      authMethodType === "ad_token_provider"
        ? compactObject({
            azureAdTokenProvider: compactObject({
              azureTenantId: formData.azure_tenant_id,
              azureClientId: formData.azure_client_id,
              azureClientSecret: formData.azure_client_secret,
              scope: formData.azure_scope,
            }),
          })
        : compactObject({
            apiKey: formData.azure_api_key,
          });

    return {
      azureOpenai: {
        azureOpenaiAuthenticationMethod: authMethod,
        azureOpenaiClientKwargs: compactObject({
          azureEndpoint: formData.azure_endpoint,
          azureDeployment: formData.azure_deployment_name,
          apiVersion: formData.azure_api_version,
          defaultHeaders: parseJsonField(formData.azure_default_headers),
        }),
      },
    };
  }

  if (isAnthropicFormData(formData)) {
    return {
      anthropic: {
        anthropicAuthenticationMethod: {
          apiKey: formData.anthropic_api_key,
        },
        anthropicClientKwargs: compactObject({
          baseUrl: formData.anthropic_base_url,
          defaultHeaders: parseJsonField(formData.anthropic_default_headers),
        }),
      },
    };
  }

  if (isAWSBedrockFormData(formData)) {
    return {
      awsBedrock: {
        awsBedrockAuthenticationMethod: {
          awsAccessKeyId: formData.aws_access_key_id,
          awsSecretAccessKey: formData.aws_secret_access_key,
          ...(formData.aws_session_token && {
            awsSessionToken: formData.aws_session_token,
          }),
        },
        awsBedrockClientKwargs: compactObject({
          regionName: formData.aws_region,
          endpointUrl: formData.aws_endpoint_url,
        }),
      },
    };
  }

  if (isGoogleGenAIFormData(formData)) {
    const httpOptions = compactObject({
      baseUrl: formData.google_base_url,
      headers: parseJsonField(formData.google_headers),
    });

    return {
      googleGenai: {
        googleGenaiAuthenticationMethod: {
          apiKey: formData.google_api_key,
        },
        googleGenaiClientKwargs: httpOptions ? { httpOptions } : {},
      },
    };
  }

  // Exhaustiveness check
  const _exhaustive: never = formData;
  throw new Error(
    `Unknown provider configuration: ${JSON.stringify(_exhaustive)}`
  );
}

/**
 * Transforms form data into the GraphQL mutation input for creating a provider.
 */
export function transformToCreateInput(
  formData: ProviderFormData
): CreateGenerativeModelCustomProviderMutationInput {
  return {
    name: formData.name,
    description: formData.description || undefined,
    provider: formData.provider,
    clientConfig: buildClientConfig(
      formData
    ) as CreateGenerativeModelCustomProviderMutationInput["clientConfig"],
  };
}

/**
 * Transforms form data into the GraphQL mutation input for updating a provider.
 *
 * Only includes fields that have changed from the original values to minimize
 * the payload size and avoid unnecessary server-side writes.
 */
export function transformToPatchInput(
  formData: ProviderFormData,
  providerId: string,
  originalValues?: Partial<ProviderFormData>
): PatchGenerativeModelCustomProviderMutationInput {
  const input: PatchGenerativeModelCustomProviderMutationInput = {
    id: providerId,
  };

  // Only include changed top-level fields
  if (formData.name !== originalValues?.name) {
    input.name = formData.name;
  }

  const originalDescription = originalValues?.description || "";
  const newDescription = formData.description || "";
  if (newDescription !== originalDescription) {
    input.description = newDescription || undefined;
  }

  if (formData.provider !== originalValues?.provider) {
    input.provider = formData.provider;
  }

  // Always include the full client config on updates
  // (credential diffing is complex and error-prone)
  input.clientConfig = buildClientConfig(formData);

  return input;
}
