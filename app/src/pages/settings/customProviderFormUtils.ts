/**
 * Custom Provider Form Data Utilities
 *
 */

import invariant from "tiny-invariant";

import {
  type GenerativeModelSDK,
  SDK_DEFAULT_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { assertUnreachable } from "@phoenix/typeUtils";
import {
  safelyJSONStringify,
  safelyParseJSONObjectString,
} from "@phoenix/utils/jsonUtils";
import { compressObject } from "@phoenix/utils/objectUtils";

import type { CustomProvidersCard_data$data } from "./__generated__/CustomProvidersCard_data.graphql";
import type { CreateGenerativeModelCustomProviderMutationInput } from "./__generated__/NewCustomProviderButtonCreateMutation.graphql";
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
        openai_default_headers: safelyJSONStringify(
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
export function buildClientConfig(formData: ProviderFormData) {
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
      const defaultHeaders =
        typeof formData.azure_default_headers === "string"
          ? safelyParseJSONObjectString(formData.azure_default_headers)
          : undefined;

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
    clientConfig: buildClientConfig(
      formData
    ) as CreateGenerativeModelCustomProviderMutationInput["clientConfig"],
  };
}
