/**
 * Custom Provider Form Data Utilities
 *
 */

import invariant from "tiny-invariant";

import {
  type GenerativeModelSDK,
  SDK_DEFAULT_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import type { EditCustomProviderButtonQuery$data } from "@phoenix/pages/settings/__generated__/EditCustomProviderButtonQuery.graphql";
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
  DecisionModelsFormData,
  GoogleGenAIFormData,
  LLMModelsFormData,
  OpenAIFormData,
  ProviderFormData,
  TypeSafeFormData,
} from "./CustomProviderForm";
import {
  type DecisionSDK,
  azureChatBaseUrl,
  guessDecisionBaseUrl,
} from "./decisionEndpoints";

export type ProviderNode = EditCustomProviderButtonQuery$data["node"];
type CustomProviderNode = Extract<
  NonNullable<ProviderNode>,
  { readonly __typename: "GenerativeModelCustomProvider" }
>;
type ProviderConfig = NonNullable<CustomProviderNode["config"]>;

/** Splits a suggested model names field: one per line or comma separated. */
export function parseModelNames(value: string | undefined): string[] {
  const names = (value ?? "")
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}

/** Suggested model names as the form edits them. */
function formatModelNames(
  modelNames: readonly string[] | null | undefined
): string | undefined {
  return modelNames?.join(", ") || undefined;
}

/** The LLM model names to send; none lists the SDK's built-in models. */
function buildModelNames(formData: LLMModelsFormData) {
  const modelNames = parseModelNames(formData.model_names);
  return modelNames.length > 0 ? { modelNames } : {};
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
  const noDecisionModels: DecisionModelsFormData = {
    decision_enabled: false,
    decision_sdk: "OPENAI",
    decision_base_url: undefined,
    decision_model_names: undefined,
  };

  switch (sdk) {
    case "OPENAI":
      return {
        ...baseDefaults,
        sdk: "OPENAI",
        provider: SDK_DEFAULT_PROVIDER.OPENAI,
        openai_api_type: "RESPONSES",
        openai_api_key: "",
        openai_base_url: undefined,
        openai_organization: undefined,
        openai_project: undefined,
        openai_default_headers: undefined,
        model_names: undefined,
        ...noDecisionModels,
      } satisfies OpenAIFormData;

    case "AZURE_OPENAI":
      return {
        ...baseDefaults,
        sdk: "AZURE_OPENAI",
        provider: SDK_DEFAULT_PROVIDER.AZURE_OPENAI,
        openai_api_type: "RESPONSES",
        azure_endpoint: "",
        azure_auth_method: "api_key",
        azure_api_key: undefined,
        azure_tenant_id: undefined,
        azure_client_id: undefined,
        azure_client_secret: undefined,
        azure_scope: undefined,
        azure_default_headers: undefined,
        model_names: undefined,
        ...noDecisionModels,
      } satisfies AzureOpenAIFormData;

    case "ANTHROPIC":
      return {
        ...baseDefaults,
        sdk: "ANTHROPIC",
        provider: SDK_DEFAULT_PROVIDER.ANTHROPIC,
        anthropic_api_key: "",
        anthropic_base_url: undefined,
        anthropic_default_headers: undefined,
        model_names: undefined,
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
        model_names: undefined,
      } satisfies AWSBedrockFormData;

    case "GOOGLE_GENAI":
      return {
        ...baseDefaults,
        sdk: "GOOGLE_GENAI",
        provider: SDK_DEFAULT_PROVIDER.GOOGLE_GENAI,
        google_api_key: "",
        google_base_url: undefined,
        google_headers: undefined,
        model_names: undefined,
      } satisfies GoogleGenAIFormData;

    case "TYPESAFE":
      return {
        ...baseDefaults,
        sdk: "TYPESAFE",
        provider: SDK_DEFAULT_PROVIDER.TYPESAFE,
        typesafe_api_key: "",
        typesafe_base_url: undefined,
        typesafe_default_headers: undefined,
        decision_enabled: true,
        decision_sdk: "TYPESAFE",
        decision_base_url: undefined,
        decision_model_names: undefined,
      } satisfies TypeSafeFormData;

    default: {
      const _exhaustive: never = sdk;
      invariant(
        false,
        `Unknown SDK type "${String(_exhaustive)}" received. ` +
          `The frontend may need to be updated to support this SDK type.`
      );
      return _exhaustive;
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
  const customProvider = provider as CustomProviderNode;
  switch (customProvider.sdk) {
    case "OPENAI":
      return transformOpenAIConfig(customProvider);
    case "AZURE_OPENAI":
      return transformAzureOpenAIConfig(customProvider);
    case "ANTHROPIC":
      return transformAnthropicConfig(customProvider);
    case "AWS_BEDROCK":
      return transformAwsBedrockConfig(customProvider);
    case "GOOGLE_GENAI":
      return transformGoogleGenAIConfig(customProvider);
    case "TYPESAFE":
      return transformTypeSafeConfig(customProvider);
    default:
      throw new Error("Unknown SDK type received from backend.");
  }
}

/**
 * Decision settings as the form edits them. A provider saved without a
 * decision base URL shows the guess its runs use.
 */
function getDecisionModelsFormValues({
  decisionModels,
  chatBaseUrl,
}: {
  decisionModels: ProviderConfig["decisionModels"];
  chatBaseUrl: string | null | undefined;
}): DecisionModelsFormData {
  if (!decisionModels) {
    return {
      decision_enabled: false,
      decision_sdk: "OPENAI",
      decision_base_url: undefined,
      decision_model_names: undefined,
    };
  }
  const decisionSdk: DecisionSDK =
    decisionModels.decisionSdk === "TYPESAFE" ? "TYPESAFE" : "OPENAI";
  return {
    decision_enabled: true,
    decision_sdk: decisionSdk,
    decision_base_url:
      decisionModels.baseUrl ??
      guessDecisionBaseUrl({ decisionSdk, chatBaseUrl }),
    decision_model_names: formatModelNames(decisionModels.modelNames),
  };
}

function getBaseFormValues(provider: CustomProviderNode) {
  return {
    name: provider.name,
    description: provider.description || "",
    provider: provider.provider,
  };
}

function transformOpenAIConfig(provider: CustomProviderNode): OpenAIFormData {
  const config = provider.config;
  return {
    ...getBaseFormValues(provider),
    sdk: "OPENAI",
    openai_api_type:
      (config?.openaiApiType as OpenAIFormData["openai_api_type"]) ??
      "RESPONSES",
    openai_api_key: config?.openaiAuthenticationMethod?.apiKey || "",
    ...getOpenAIClientFormValues(config?.openaiClientKwargs),
    model_names: formatModelNames(config?.modelNames),
    ...getDecisionModelsFormValues({
      decisionModels: config?.decisionModels,
      chatBaseUrl: config?.openaiClientKwargs?.baseUrl,
    }),
  };
}

function getOpenAIClientFormValues(
  kwargs: ProviderConfig["openaiClientKwargs"]
): Pick<
  OpenAIFormData,
  | "openai_base_url"
  | "openai_organization"
  | "openai_project"
  | "openai_default_headers"
> {
  return {
    openai_base_url: kwargs?.baseUrl ?? undefined,
    openai_organization: kwargs?.organization ?? undefined,
    openai_project: kwargs?.project ?? undefined,
    openai_default_headers: safelyJSONStringify(kwargs?.defaultHeaders),
  };
}

function transformAzureOpenAIConfig(
  provider: CustomProviderNode
): AzureOpenAIFormData {
  const config = provider.config;
  return {
    ...getBaseFormValues(provider),
    sdk: "AZURE_OPENAI",
    openai_api_type:
      (config?.openaiApiType as AzureOpenAIFormData["openai_api_type"]) ??
      "RESPONSES",
    ...getAzureAuthenticationFormValues(
      config?.azureOpenaiAuthenticationMethod
    ),
    ...getAzureClientFormValues(config?.azureOpenaiClientKwargs),
    model_names: formatModelNames(config?.modelNames),
    ...getDecisionModelsFormValues({
      decisionModels: config?.decisionModels,
      chatBaseUrl: azureChatBaseUrl(
        config?.azureOpenaiClientKwargs?.azureEndpoint
      ),
    }),
  };
}

function getAzureAuthenticationFormValues(
  authMethod: ProviderConfig["azureOpenaiAuthenticationMethod"]
): Pick<
  AzureOpenAIFormData,
  | "azure_auth_method"
  | "azure_api_key"
  | "azure_tenant_id"
  | "azure_client_id"
  | "azure_client_secret"
  | "azure_scope"
> {
  const tokenProvider = authMethod?.azureAdTokenProvider;
  return {
    azure_auth_method: authMethod?.defaultCredentials
      ? "default_credentials"
      : tokenProvider
        ? "ad_token_provider"
        : "api_key",
    azure_api_key: authMethod?.apiKey ?? undefined,
    azure_tenant_id: tokenProvider?.azureTenantId ?? undefined,
    azure_client_id: tokenProvider?.azureClientId ?? undefined,
    azure_client_secret: tokenProvider?.azureClientSecret ?? undefined,
    azure_scope: tokenProvider?.scope ?? undefined,
  };
}

function getAzureClientFormValues(
  kwargs: ProviderConfig["azureOpenaiClientKwargs"]
): Pick<AzureOpenAIFormData, "azure_endpoint" | "azure_default_headers"> {
  return {
    azure_endpoint: kwargs?.azureEndpoint ?? "",
    azure_default_headers: safelyJSONStringify(kwargs?.defaultHeaders),
  };
}

function transformAnthropicConfig(
  provider: CustomProviderNode
): AnthropicFormData {
  const config = provider.config;
  return {
    ...getBaseFormValues(provider),
    sdk: "ANTHROPIC",
    anthropic_api_key: config?.anthropicAuthenticationMethod?.apiKey || "",
    anthropic_base_url: config?.anthropicClientKwargs?.baseUrl ?? undefined,
    anthropic_default_headers: safelyJSONStringify(
      config?.anthropicClientKwargs?.defaultHeaders
    ),
    model_names: formatModelNames(config?.modelNames),
  };
}

function transformAwsBedrockConfig(
  provider: CustomProviderNode
): AWSBedrockFormData {
  const config = provider.config;
  const authMethod = config?.awsBedrockAuthenticationMethod;
  return {
    ...getBaseFormValues(provider),
    sdk: "AWS_BEDROCK",
    aws_region: config?.awsBedrockClientKwargs?.regionName || "",
    aws_auth_method: authMethod?.defaultCredentials
      ? "default_credentials"
      : "access_keys",
    aws_access_key_id: authMethod?.accessKeys?.awsAccessKeyId ?? undefined,
    aws_secret_access_key:
      authMethod?.accessKeys?.awsSecretAccessKey ?? undefined,
    aws_session_token: authMethod?.accessKeys?.awsSessionToken ?? undefined,
    aws_endpoint_url: config?.awsBedrockClientKwargs?.endpointUrl ?? undefined,
    model_names: formatModelNames(config?.modelNames),
  };
}

function transformGoogleGenAIConfig(
  provider: CustomProviderNode
): GoogleGenAIFormData {
  const config = provider.config;
  const httpOptions = config?.googleGenaiClientKwargs?.httpOptions;
  return {
    ...getBaseFormValues(provider),
    sdk: "GOOGLE_GENAI",
    google_api_key: config?.googleGenaiAuthenticationMethod?.apiKey || "",
    google_base_url: httpOptions?.baseUrl ?? undefined,
    google_headers: safelyJSONStringify(httpOptions?.headers),
    model_names: formatModelNames(config?.modelNames),
  };
}

function transformTypeSafeConfig(
  provider: CustomProviderNode
): TypeSafeFormData {
  const config = provider.config;
  return {
    ...getBaseFormValues(provider),
    sdk: "TYPESAFE",
    typesafe_api_key: config?.typesafeAuthenticationMethod?.apiKey || "",
    typesafe_base_url: config?.typesafeClientKwargs?.baseUrl ?? undefined,
    typesafe_default_headers: safelyJSONStringify(
      config?.typesafeClientKwargs?.defaultHeaders
    ),
    decision_enabled: true,
    decision_sdk: "TYPESAFE",
    decision_base_url: undefined,
    decision_model_names: formatModelNames(config?.decisionModels?.modelNames),
  };
}

// =============================================================================
// Form → GraphQL Transformation
// =============================================================================

/**
 * The decision settings to send: none when decision models are off, so the
 * provider stops serving them.
 */
function buildDecisionModels({
  formData,
  chatBaseUrl,
}: {
  formData: DecisionModelsFormData;
  /** The provider's chat base URL; a decision base URL equal to its guess isn't sent. */
  chatBaseUrl: string | null | undefined;
}) {
  if (!formData.decision_enabled) {
    return undefined;
  }
  const modelNames = parseModelNames(formData.decision_model_names);
  const baseUrl = formData.decision_base_url?.trim().replace(/\/+$/, "");
  // The pre-filled guess isn't stored, so runs keep following the chat base
  // URL; only a base URL the user changed is pinned.
  const isGuess =
    baseUrl ===
    guessDecisionBaseUrl({ decisionSdk: formData.decision_sdk, chatBaseUrl });
  return {
    decisionSdk: formData.decision_sdk,
    ...(baseUrl && !isGuess && { baseUrl }),
    ...(modelNames.length > 0 && { modelNames }),
  };
}

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
          openaiApiType: formData.openai_api_type,
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
          ...buildModelNames(formData),
          decisionModels: buildDecisionModels({
            formData,
            chatBaseUrl: formData.openai_base_url,
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
      const azureAuthMethod = formData.azure_auth_method;
      const authMethod: AzureOpenAIAuthenticationMethodInput = (() => {
        switch (azureAuthMethod) {
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
          default: {
            const _exhaustive: never = azureAuthMethod;
            invariant(
              false,
              `Unknown Azure auth method: ${String(_exhaustive)}`
            );
            return _exhaustive;
          }
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
          openaiApiType: formData.openai_api_type,
          azureOpenaiAuthenticationMethod: authMethod,
          azureOpenaiClientKwargs: {
            azureEndpoint: formData.azure_endpoint,
            ...(defaultHeaders !== undefined && { defaultHeaders }),
          },
          ...buildModelNames(formData),
          decisionModels: buildDecisionModels({
            formData,
            chatBaseUrl: azureChatBaseUrl(formData.azure_endpoint),
          }),
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
          ...buildModelNames(formData),
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
      const awsAuthMethodInput = formData.aws_auth_method;
      const awsAuthMethod = (() => {
        switch (awsAuthMethodInput) {
          case "default_credentials":
            return { defaultCredentials: true as const };
          case "access_keys":
            invariant(
              formData.aws_access_key_id,
              "AWS Access Key ID is required for access keys authentication"
            );
            invariant(
              formData.aws_secret_access_key,
              "AWS Secret Access Key is required for access keys authentication"
            );
            return {
              accessKeys: {
                awsAccessKeyId: formData.aws_access_key_id,
                awsSecretAccessKey: formData.aws_secret_access_key,
                ...(formData.aws_session_token && {
                  awsSessionToken: formData.aws_session_token,
                }),
              },
            };
          default: {
            const _exhaustive: never = awsAuthMethodInput;
            invariant(false, `Unknown AWS auth method: ${String(_exhaustive)}`);
            return _exhaustive;
          }
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
          ...buildModelNames(formData),
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
          ...buildModelNames(formData),
        },
      };
    }
    case "TYPESAFE":
      return {
        typesafe: {
          typesafeAuthenticationMethod: {
            apiKey: formData.typesafe_api_key,
          },
          typesafeClientKwargs: compressObject({
            baseUrl: formData.typesafe_base_url,
            defaultHeaders:
              typeof formData.typesafe_default_headers === "string"
                ? safelyParseJSONObjectString(formData.typesafe_default_headers)
                : undefined,
          }),
          // Always System One; a TypeSafe provider's own base URL is its endpoint.
          decisionModels: buildDecisionModels({
            formData: {
              ...formData,
              decision_enabled: true,
              decision_sdk: "TYPESAFE",
              decision_base_url: undefined,
            },
            chatBaseUrl: formData.typesafe_base_url,
          }),
        },
      };
    default: {
      return assertUnreachable(formData);
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
const DECISION_FIELDS = [
  "decision_enabled",
  "decision_sdk",
  "decision_base_url",
  "decision_model_names",
] as const;

const CONFIG_FIELDS_BY_SDK: Record<GenerativeModelSDK, readonly string[]> = {
  OPENAI: [
    "openai_api_type",
    "openai_api_key",
    "openai_base_url",
    "openai_organization",
    "openai_project",
    "openai_default_headers",
    "model_names",
    ...DECISION_FIELDS,
  ],
  AZURE_OPENAI: [
    "openai_api_type",
    "azure_endpoint",
    "azure_auth_method",
    "azure_api_key",
    "azure_tenant_id",
    "azure_client_id",
    "azure_client_secret",
    "azure_scope",
    "azure_default_headers",
    "model_names",
    ...DECISION_FIELDS,
  ],
  ANTHROPIC: [
    "anthropic_api_key",
    "anthropic_base_url",
    "anthropic_default_headers",
    "model_names",
  ],
  AWS_BEDROCK: [
    "aws_region",
    "aws_auth_method",
    "aws_access_key_id",
    "aws_secret_access_key",
    "aws_session_token",
    "aws_endpoint_url",
    "model_names",
  ],
  GOOGLE_GENAI: [
    "google_api_key",
    "google_base_url",
    "google_headers",
    "model_names",
  ],
  TYPESAFE: [
    "typesafe_api_key",
    "typesafe_base_url",
    "typesafe_default_headers",
    "decision_model_names",
  ],
};

function hasConfigChanged(
  formData: ProviderFormData,
  originalValues: ProviderFormData
): boolean {
  if (formData.sdk !== originalValues.sdk) return true;

  const current = formData as unknown as Record<string, unknown>;
  const original = originalValues as unknown as Record<string, unknown>;
  return CONFIG_FIELDS_BY_SDK[formData.sdk].some(
    (field) => current[field] !== original[field]
  );
}
