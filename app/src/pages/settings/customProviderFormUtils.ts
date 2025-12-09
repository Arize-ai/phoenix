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

import invariant from "tiny-invariant";

import { compressObject } from "@phoenix/utils/objectUtils";

import type {
  CustomProvidersCard_data$data,
  GenerativeModelSDK,
} from "./__generated__/CustomProvidersCard_data.graphql";
import type { CreateGenerativeModelCustomProviderMutationInput } from "./__generated__/NewCustomProviderButtonCreateMutation.graphql";
import { SDK_DEFAULT_PROVIDER } from "./customProviderConstants";
import type {
  AnthropicFormData,
  AWSBedrockFormData,
  AzureOpenAIFormData,
  GoogleGenAIFormData,
  OpenAIFormData,
  ProviderFormData,
} from "./CustomProviderForm";

/**
 * GraphQL provider node type alias for better readability
 */
type ProviderNode =
  CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"];

/**
 * Removes null, undefined, empty strings, empty objects, and empty arrays from an object.
 * Returns undefined if the resulting object would be empty.
 *
 * Used to build compact GraphQL mutation inputs that only include defined values.
 *
 * @returns A partial version of the input object with empty values removed,
 *          or undefined if all values were empty.
 *
 * @remarks
 * The return type is `Partial<T> | undefined` which provides better type safety
 * than `any` while still being compatible with GraphQL mutation inputs.
 * The GraphQL schema enforces required fields at the server layer, and
 * Zod validation ensures required fields are present before submission.
 */
function compactObject<T extends Record<string, unknown>>(
  obj: T
): Partial<T> | undefined {
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

  return Object.fromEntries(entries) as Partial<T>;
}

/**
 * Parses a JSON string into an object or array.
 *
 * @returns undefined for empty/whitespace-only strings or invalid JSON
 * @remarks
 * This function is intentionally safe and returns undefined on parse errors
 * rather than throwing. Zod validation should catch invalid JSON before
 * form submission, but this provides defense-in-depth for edge cases.
 */
function parseJsonField(
  value: string | undefined
): Record<string, unknown> | unknown[] | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    return parsed as Record<string, unknown> | unknown[];
  } catch {
    // Invalid JSON - return undefined rather than throwing
    // Zod validation should have caught this, but be defensive
    return undefined;
  }
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
  sdk: GenerativeModelSDK
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
        provider: SDK_DEFAULT_PROVIDER.OPENAI,
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
        provider: SDK_DEFAULT_PROVIDER.AZURE_OPENAI,
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
        provider: SDK_DEFAULT_PROVIDER.ANTHROPIC,
        anthropic_api_key: "",
        anthropic_base_url: undefined,
        anthropic_default_headers: undefined,
      } satisfies AnthropicFormData;

    case "AWS_BEDROCK":
      return {
        ...baseDefaults,
        sdk: "AWS_BEDROCK",
        provider: SDK_DEFAULT_PROVIDER.AWS_BEDROCK,
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
        provider: SDK_DEFAULT_PROVIDER.GOOGLE_GENAI,
        google_api_key: "",
        google_base_url: undefined,
        google_headers: undefined,
      } satisfies GoogleGenAIFormData;

    default: {
      const _exhaustive: never = sdk;
      invariant(
        false,
        `Unknown SDK type "${String(_exhaustive)}" received. ` +
          `The frontend may need to be updated to support this SDK type.`
      );
    }
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

    default: {
      const _exhaustive: never = sdk;
      invariant(
        false,
        `Unknown SDK type "${String(_exhaustive)}" received from backend. ` +
          `The frontend may need to be updated to support this SDK type.`
      );
    }
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
        ? compressObject({
            azureAdTokenProvider: compressObject({
              azureTenantId: formData.azure_tenant_id,
              azureClientId: formData.azure_client_id,
              azureClientSecret: formData.azure_client_secret,
              scope: formData.azure_scope,
            }),
          })
        : compressObject({
            apiKey: formData.azure_api_key,
          });

    // Validate required fields before constructing the object.
    // These should be guaranteed by Zod validation, but we assert here for type safety
    // and defense-in-depth against validation bypasses.
    invariant(
      formData.azure_endpoint,
      "Azure endpoint is required but was empty"
    );
    invariant(
      formData.azure_deployment_name,
      "Azure deployment name is required but was empty"
    );
    invariant(
      formData.azure_api_version,
      "Azure API version is required but was empty"
    );
    invariant(
      authMethod,
      "Azure authentication method is required but was empty"
    );

    // Build azureOpenaiClientKwargs with required fields directly (not via compactObject)
    // to ensure it's never undefined. Optional fields are added conditionally.
    const defaultHeaders = parseJsonField(formData.azure_default_headers);

    return {
      azureOpenai: {
        azureOpenaiAuthenticationMethod: authMethod,
        azureOpenaiClientKwargs: {
          azureEndpoint: formData.azure_endpoint,
          azureDeployment: formData.azure_deployment_name,
          apiVersion: formData.azure_api_version,
          ...(defaultHeaders !== undefined && { defaultHeaders }),
        },
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
    // Validate required field before constructing the object.
    // This should be guaranteed by Zod validation, but we assert here for type safety
    // and defense-in-depth against validation bypasses.
    invariant(formData.aws_region, "AWS region is required but was empty");

    return {
      awsBedrock: {
        awsBedrockAuthenticationMethod: {
          awsAccessKeyId: formData.aws_access_key_id,
          awsSecretAccessKey: formData.aws_secret_access_key,
          ...(formData.aws_session_token && {
            awsSessionToken: formData.aws_session_token,
          }),
        },
        // Build awsBedrockClientKwargs with required fields directly (not via compactObject)
        // to ensure it's never undefined. Optional fields are added conditionally.
        awsBedrockClientKwargs: {
          regionName: formData.aws_region,
          ...(formData.aws_endpoint_url && {
            endpointUrl: formData.aws_endpoint_url,
          }),
        },
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
        // Only include googleGenaiClientKwargs if there are httpOptions to send
        ...(httpOptions && { googleGenaiClientKwargs: { httpOptions } }),
      },
    };
  }

  // Exhaustiveness check
  const _exhaustive: never = formData;
  invariant(
    false,
    `Unknown SDK type in form data. ` +
      `The frontend may need to be updated to support this SDK type. ` +
      `Data: ${JSON.stringify(_exhaustive)}`
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
