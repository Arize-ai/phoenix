/**
 * Custom Provider Form Data Utilities
 *
 */

import invariant from "tiny-invariant";

import {
  type GenerativeModelSDK,
  SDK_DEFAULT_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { EditCustomProviderButtonQuery$data } from "@phoenix/pages/settings/__generated__/EditCustomProviderButtonQuery.graphql";
import { assertUnreachable } from "@phoenix/typeUtils";
import {
  safelyJSONStringify,
  safelyParseJSONObjectString,
} from "@phoenix/utils/jsonUtils";
import { compressObject } from "@phoenix/utils/objectUtils";

import type { PatchGenerativeModelCustomProviderMutationInput } from "./__generated__/EditCustomProviderButtonPatchMutation.graphql";
import type {
  AzureOpenAIAuthenticationMethodInput,
  CreateGenerativeModelCustomProviderMutationInput,
  GenerativeModelCustomerProviderConfigInput,
} from "./__generated__/NewCustomProviderButtonCreateMutation.graphql";
import type {
  AnthropicFormData,
  AWSBedrockFormData,
  AzureOpenAIFormData,
  GoogleGenAIFormData,
  OpenAIFormData,
  ProviderFormData,
} from "./CustomProviderForm";

export type ProviderNode = EditCustomProviderButtonQuery$data["node"];

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
        aws_auth_method: "default_credentials",
        aws_access_key_id: undefined,
        aws_secret_access_key: undefined,
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
 *
 * Returns a complete ProviderFormData with all required fields filled in.
 */
export function transformConfigToFormValues(
  provider: ProviderNode
): ProviderFormData {
  invariant(
    provider.__typename === "GenerativeModelCustomProvider",
    "Node is not a generative model custom provider"
  );
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
        openai_default_headers: safelyJSONStringify(
          config?.openaiClientKwargs?.defaultHeaders
        ),
      };

    case "AZURE_OPENAI": {
      const authMethod = config?.azureOpenaiAuthenticationMethod;
      const kwargs = config?.azureOpenaiClientKwargs;

      // Determine auth method based on which credentials are present
      let authMethodType: AzureOpenAIFormData["azure_auth_method"] = "api_key";
      if (authMethod?.defaultCredentials) {
        authMethodType = "default_credentials";
      } else if (authMethod?.azureAdTokenProvider) {
        authMethodType = "ad_token_provider";
      }

      return {
        ...baseValues,
        sdk: "AZURE_OPENAI",
        azure_endpoint: kwargs?.azureEndpoint ?? "",
        azure_auth_method: authMethodType,
        azure_api_key: authMethod?.apiKey ?? undefined,
        azure_tenant_id:
          authMethod?.azureAdTokenProvider?.azureTenantId ?? undefined,
        azure_client_id:
          authMethod?.azureAdTokenProvider?.azureClientId ?? undefined,
        azure_client_secret:
          authMethod?.azureAdTokenProvider?.azureClientSecret ?? undefined,
        azure_scope: authMethod?.azureAdTokenProvider?.scope ?? undefined,
        azure_default_headers: safelyJSONStringify(kwargs?.defaultHeaders),
      };
    }

    case "ANTHROPIC":
      return {
        ...baseValues,
        sdk: "ANTHROPIC",
        anthropic_api_key: config?.anthropicAuthenticationMethod?.apiKey || "",
        anthropic_base_url: config?.anthropicClientKwargs?.baseUrl ?? undefined,
        anthropic_default_headers: safelyJSONStringify(
          config?.anthropicClientKwargs?.defaultHeaders
        ),
      };

    case "AWS_BEDROCK": {
      const authMethod = config?.awsBedrockAuthenticationMethod;
      // Determine auth method based on which fields are present
      let authMethodType: AWSBedrockFormData["aws_auth_method"] = "access_keys";
      if (authMethod?.defaultCredentials) {
        authMethodType = "default_credentials";
      }

      return {
        ...baseValues,
        sdk: "AWS_BEDROCK",
        aws_region: config?.awsBedrockClientKwargs?.regionName || "",
        aws_auth_method: authMethodType,
        aws_access_key_id: authMethod?.accessKeys?.awsAccessKeyId ?? undefined,
        aws_secret_access_key:
          authMethod?.accessKeys?.awsSecretAccessKey ?? undefined,
        aws_session_token: authMethod?.accessKeys?.awsSessionToken ?? undefined,
        aws_endpoint_url:
          config?.awsBedrockClientKwargs?.endpointUrl ?? undefined,
      };
    }

    case "GOOGLE_GENAI": {
      const httpOptions = config?.googleGenaiClientKwargs?.httpOptions;
      return {
        ...baseValues,
        sdk: "GOOGLE_GENAI",
        google_api_key: config?.googleGenaiAuthenticationMethod?.apiKey || "",
        google_base_url: httpOptions?.baseUrl ?? undefined,
        google_headers: safelyJSONStringify(httpOptions?.headers),
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
 * the GraphQL schema. Uses a switch statement on the `sdk` discriminant
 * for automatic type narrowing.
 */
export function buildClientConfig(
  formData: ProviderFormData
): GenerativeModelCustomerProviderConfigInput {
  switch (formData.sdk) {
    case "OPENAI":
      return {
        openai: {
          openaiAuthenticationMethod: {
            apiKey: formData.openai_api_key,
          },
          openaiClientKwargs: compressObject({
            baseUrl: formData.openai_base_url,
            organization: formData.openai_organization,
            project: formData.openai_project,
            defaultHeaders:
              typeof formData.openai_default_headers === "string"
                ? safelyParseJSONObjectString(formData.openai_default_headers)
                : undefined,
          }),
        },
      };
    case "AZURE_OPENAI": {
      invariant(
        formData.azure_auth_method,
        "Azure authentication method is required but was empty"
      );

      // Validate required fields before constructing the object.
      // These should be guaranteed by Zod validation, but we assert here for type safety
      // and defense-in-depth against validation bypasses.
      invariant(
        formData.azure_endpoint,
        "Azure endpoint is required but was empty"
      );

      // Build auth method based on selected type
      // Note: We don't use compressObject here because the GraphQL types require
      // specific fields to be non-optional
      const authMethod: AzureOpenAIAuthenticationMethodInput = (() => {
        switch (formData.azure_auth_method) {
          case "default_credentials":
            return { defaultCredentials: true };
          case "ad_token_provider":
            invariant(
              formData.azure_tenant_id,
              "Azure tenant ID is required for AD token provider"
            );
            invariant(
              formData.azure_client_id,
              "Azure client ID is required for AD token provider"
            );
            invariant(
              formData.azure_client_secret,
              "Azure client secret is required for AD token provider"
            );
            return {
              azureAdTokenProvider: {
                azureTenantId: formData.azure_tenant_id,
                azureClientId: formData.azure_client_id,
                azureClientSecret: formData.azure_client_secret,
                ...(formData.azure_scope && { scope: formData.azure_scope }),
              },
            };
          case "api_key":
            invariant(
              formData.azure_api_key,
              "Azure API key is required when using API key authentication"
            );
            return { apiKey: formData.azure_api_key };
          default:
            invariant(
              false,
              `Unknown Azure auth method: ${formData.azure_auth_method}`
            );
        }
      })();

      // Build azureOpenaiClientKwargs with required fields directly (not via compactObject)
      // to ensure it's never undefined. Optional fields are added conditionally.
      const defaultHeaders =
        typeof formData.azure_default_headers === "string"
          ? safelyParseJSONObjectString(formData.azure_default_headers)
          : undefined;

      return {
        azureOpenai: {
          azureOpenaiAuthenticationMethod: authMethod,
          azureOpenaiClientKwargs: {
            azureEndpoint: formData.azure_endpoint,
            ...(defaultHeaders !== undefined && { defaultHeaders }),
          },
        },
      };
    }
    case "ANTHROPIC":
      return {
        anthropic: {
          anthropicAuthenticationMethod: {
            apiKey: formData.anthropic_api_key,
          },
          anthropicClientKwargs: compressObject({
            baseUrl: formData.anthropic_base_url,
            defaultHeaders:
              typeof formData.anthropic_default_headers === "string"
                ? safelyParseJSONObjectString(
                    formData.anthropic_default_headers
                  )
                : undefined,
          }),
        },
      };
    case "AWS_BEDROCK": {
      // Validate required fields before constructing the object.
      // This should be guaranteed by Zod validation, but we assert here for type safety
      // and defense-in-depth against validation bypasses.
      invariant(formData.aws_region, "AWS region is required but was empty");
      invariant(
        formData.aws_auth_method,
        "AWS authentication method is required but was empty"
      );

      // Build auth method based on selected type
      const awsAuthMethod = (() => {
        switch (formData.aws_auth_method) {
          case "default_credentials":
            return { defaultCredentials: true as const };
          case "access_keys":
            return {
              accessKeys: {
                awsAccessKeyId: formData.aws_access_key_id!,
                awsSecretAccessKey: formData.aws_secret_access_key!,
                ...(formData.aws_session_token && {
                  awsSessionToken: formData.aws_session_token,
                }),
              },
            };
          default:
            invariant(
              false,
              `Unknown AWS auth method: ${formData.aws_auth_method}`
            );
        }
      })();

      return {
        awsBedrock: {
          awsBedrockAuthenticationMethod: awsAuthMethod,
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
    case "GOOGLE_GENAI": {
      const httpOptions = compressObject({
        baseUrl: formData.google_base_url,
        headers:
          typeof formData.google_headers === "string"
            ? safelyParseJSONObjectString(formData.google_headers)
            : undefined,
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
    default: {
      assertUnreachable(formData);
    }
  }
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
    clientConfig: buildClientConfig(formData),
  };
}

/**
 * Transforms form data into the GraphQL mutation input for patching/updating a provider.
 *
 * Compares new values with original values and only includes changed fields in the patch.
 * The `id` field is always included as it's required by the mutation.
 */
export function transformToPatchInput(
  formData: ProviderFormData,
  providerId: string,
  originalValues: ProviderFormData
): PatchGenerativeModelCustomProviderMutationInput {
  const input: PatchGenerativeModelCustomProviderMutationInput = {
    id: providerId,
  };

  // Check base fields for changes
  if (formData.name !== originalValues.name) {
    input.name = formData.name;
  }

  if (formData.description !== originalValues.description) {
    input.description = formData.description || null;
  }

  if (formData.provider !== originalValues.provider) {
    input.provider = formData.provider;
  }

  // For clientConfig, we always send the full config if any SDK-specific field changed.
  // This is simpler and safer than trying to diff nested config structures.
  const configChanged = hasConfigChanged(formData, originalValues);
  if (configChanged) {
    input.clientConfig = buildClientConfig(formData);
  }

  return input;
}

/**
 * Checks if any SDK-specific configuration fields have changed.
 * Returns true if any field in the config section differs from the original.
 */
function hasConfigChanged(
  formData: ProviderFormData,
  originalValues: ProviderFormData
): boolean {
  // If SDK changed, config definitely changed
  if (formData.sdk !== originalValues.sdk) {
    return true;
  }

  // Compare SDK-specific fields based on the SDK type.
  // We use invariant to narrow originalValues since TypeScript can't track
  // the relationship established by the early return above.
  switch (formData.sdk) {
    case "OPENAI": {
      invariant(originalValues.sdk === "OPENAI", "SDK mismatch");
      return (
        formData.openai_api_key !== originalValues.openai_api_key ||
        formData.openai_base_url !== originalValues.openai_base_url ||
        formData.openai_organization !== originalValues.openai_organization ||
        formData.openai_project !== originalValues.openai_project ||
        formData.openai_default_headers !==
          originalValues.openai_default_headers
      );
    }
    case "AZURE_OPENAI": {
      invariant(originalValues.sdk === "AZURE_OPENAI", "SDK mismatch");
      return (
        formData.azure_endpoint !== originalValues.azure_endpoint ||
        formData.azure_auth_method !== originalValues.azure_auth_method ||
        formData.azure_api_key !== originalValues.azure_api_key ||
        formData.azure_tenant_id !== originalValues.azure_tenant_id ||
        formData.azure_client_id !== originalValues.azure_client_id ||
        formData.azure_client_secret !== originalValues.azure_client_secret ||
        formData.azure_scope !== originalValues.azure_scope ||
        formData.azure_default_headers !== originalValues.azure_default_headers
      );
    }
    case "ANTHROPIC": {
      invariant(originalValues.sdk === "ANTHROPIC", "SDK mismatch");
      return (
        formData.anthropic_api_key !== originalValues.anthropic_api_key ||
        formData.anthropic_base_url !== originalValues.anthropic_base_url ||
        formData.anthropic_default_headers !==
          originalValues.anthropic_default_headers
      );
    }
    case "AWS_BEDROCK": {
      invariant(originalValues.sdk === "AWS_BEDROCK", "SDK mismatch");
      return (
        formData.aws_region !== originalValues.aws_region ||
        formData.aws_auth_method !== originalValues.aws_auth_method ||
        formData.aws_access_key_id !== originalValues.aws_access_key_id ||
        formData.aws_secret_access_key !==
          originalValues.aws_secret_access_key ||
        formData.aws_session_token !== originalValues.aws_session_token ||
        formData.aws_endpoint_url !== originalValues.aws_endpoint_url
      );
    }
    case "GOOGLE_GENAI": {
      invariant(originalValues.sdk === "GOOGLE_GENAI", "SDK mismatch");
      return (
        formData.google_api_key !== originalValues.google_api_key ||
        formData.google_base_url !== originalValues.google_base_url ||
        formData.google_headers !== originalValues.google_headers
      );
    }
    default: {
      assertUnreachable(formData);
    }
  }
}
