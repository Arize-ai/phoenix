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
  DeepSeekFormData,
  GoogleGenAIFormData,
  OllamaFormData,
  OpenAIFormData,
  ProviderFormData,
  XAIFormData,
} from "./CustomProviderForm";

/**
 * Extract string value from StringValueLookupOrStringValue union type.
 * Prioritizes stringValue over stringValueLookupKey.
 */
/**
 * Extract the string value from a union type and determine if it's an env var
 */
function extractStringValue(
  field:
    | { readonly stringValue?: string; readonly stringValueLookupKey?: string }
    | null
    | undefined
): { value: string | undefined; isEnvVar: boolean } {
  if (!field) return { value: undefined, isEnvVar: false };
  if (field.stringValueLookupKey) {
    return { value: field.stringValueLookupKey, isEnvVar: true };
  }
  return { value: field.stringValue, isEnvVar: false };
}

/**
 * Convert a plain string value into the StringValueLookupOrStringValue input format.
 * Wraps the string in either stringValue or stringValueLookupKey based on isEnvVar flag.
 * Returns null instead of undefined so fields can be properly omitted.
 */
function toStringValueInput(
  value: string | undefined,
  isEnvVar: boolean = false
): { stringValue: string } | { stringValueLookupKey: string } | null {
  if (!value || value.trim() === "") return null;
  if (isEnvVar) {
    return { stringValueLookupKey: value };
  }
  return { stringValue: value };
}

/**
 * Helper to build an object with only non-null values.
 * Returns `any` to work with GraphQL mutation input types that don't accept undefined.
 * Also filters out empty objects and empty arrays.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compactObject<T extends Record<string, any>>(obj: T): any {
  const result = Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => {
      if (v === null || v === undefined) return false;
      // Filter out empty objects
      if (
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0
      )
        return false;
      // Filter out empty arrays
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
  );
  // Return undefined if the result is an empty object
  return Object.keys(result).length === 0 ? undefined : result;
}

export const modelProviderToSDK: Record<
  ModelProvider | "CUSTOM",
  GenerativeModelCustomProviderSDK | ""
> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS: "AWS_BEDROCK",
  GOOGLE: "GOOGLE_GENAI",
  DEEPSEEK: "OPENAI",
  XAI: "OPENAI",
  OLLAMA: "OPENAI",
  CUSTOM: "",
};

export const modelProviderToProviderString: Record<
  ModelProvider | "CUSTOM",
  string
> = {
  OPENAI: "openai",
  AZURE_OPENAI: "azure",
  ANTHROPIC: "anthropic",
  AWS: "aws",
  GOOGLE: "google",
  DEEPSEEK: "deepseek",
  XAI: "xai",
  OLLAMA: "ollama",
  CUSTOM: "",
};

/**
 * Create type-safe default form values for each provider type
 * This ensures all required fields are present and properly typed
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
        provider: "openai",
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
        provider: "azure",
        azure_endpoint: "",
        azure_deployment_name: "",
        azure_api_version: "",
        azure_auth_method: "api_key",
        azure_api_key: undefined,
        azure_ad_token: undefined,
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
        provider: "anthropic",
        anthropic_api_key: "",
        anthropic_base_url: undefined,
        anthropic_default_headers: undefined,
      } satisfies AnthropicFormData;

    case "AWS_BEDROCK":
      return {
        ...baseDefaults,
        sdk: "AWS_BEDROCK",
        provider: "aws",
        aws_region: "",
        aws_access_key_id: "",
        aws_secret_access_key: "",
        aws_session_token: undefined,
      } satisfies AWSBedrockFormData;

    case "GOOGLE_GENAI":
      return {
        ...baseDefaults,
        sdk: "GOOGLE_GENAI",
        provider: "google",
        google_api_key: "",
        google_base_url: undefined,
        google_headers: undefined,
      } satisfies GoogleGenAIFormData;

    default: {
      // Exhaustiveness check
      const _exhaustive: never = sdk;
      throw new Error(`Unknown SDK: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Create default form data for provider-specific variants (DeepSeek, xAI, Ollama)
 */
export function createProviderSpecificDefaults(
  provider: "deepseek" | "xai" | "ollama"
): ProviderFormData {
  const baseDefaults = {
    name: "",
    description: "",
    sdk: "OPENAI" as const,
  };

  switch (provider) {
    case "deepseek":
      return {
        ...baseDefaults,
        provider: "deepseek",
        deepseek_api_key: "",
        deepseek_base_url: undefined,
        deepseek_organization: undefined,
        deepseek_project: undefined,
        deepseek_default_headers: undefined,
      } satisfies DeepSeekFormData;

    case "xai":
      return {
        ...baseDefaults,
        provider: "xai",
        xai_api_key: "",
        xai_base_url: undefined,
        xai_organization: undefined,
        xai_project: undefined,
        xai_default_headers: undefined,
      } satisfies XAIFormData;

    case "ollama":
      return {
        ...baseDefaults,
        provider: "ollama",
        ollama_base_url: undefined,
        ollama_organization: undefined,
        ollama_project: undefined,
        ollama_default_headers: undefined,
      } satisfies OllamaFormData;

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Result type for JSON parsing operations
 */
type JsonParseResult =
  | { success: true; data: Record<string, unknown> | unknown[] }
  | { success: false; error: string };

/**
 * Safely parse JSON string with detailed error reporting
 * Returns undefined for empty values, or the parsed data
 * Throws an error with a descriptive message if JSON is invalid
 */
function parseJsonField(
  value: string | undefined
): Record<string, unknown> | unknown[] | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    // Validate that it's an object or array
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("JSON must be an object or array");
    }
    return parsed as Record<string, unknown> | unknown[];
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid JSON: ${errorMessage}`);
  }
}

/**
 * Validate JSON string without throwing
 * Useful for form validation
 * @export
 */
export function validateJsonField(value: string | undefined): JsonParseResult {
  if (!value || value.trim() === "") {
    return { success: true, data: {} };
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return { success: false, error: "JSON must be an object or array" };
    }
    return { success: true, data: parsed };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Invalid JSON: ${errorMessage}` };
  }
}

/**
 * Transforms provider form data into the GraphQL mutation input format
 * for creating a new provider
 */
export function transformToCreateInput(
  formData: ProviderFormData
): CreateGenerativeModelCustomProviderMutationInput {
  const { name, description, provider } = formData;

  const clientConfig = buildClientConfig(formData);
  // For creates, apiKey is always included (required field)
  const input: CreateGenerativeModelCustomProviderMutationInput = {
    name,
    description: description || undefined,
    provider,
    // Type assertion: buildClientConfig always includes required fields for creates
    // The conditional logic makes it difficult for TypeScript to infer the exact type
    clientConfig:
      clientConfig as CreateGenerativeModelCustomProviderMutationInput["clientConfig"],
  };

  return input;
}

/**
 * Transforms provider form data into the GraphQL mutation input format
 * for updating an existing provider
 */
export function transformToPatchInput(
  formData: ProviderFormData,
  providerId: string,
  originalValues?: Partial<ProviderFormData>
): PatchGenerativeModelCustomProviderMutationInput {
  const { name, description, provider } = formData;

  const input: PatchGenerativeModelCustomProviderMutationInput = {
    id: providerId,
  };

  // Only include fields that have changed
  if (name !== originalValues?.name) {
    input.name = name;
  }
  if (description !== (originalValues?.description || "")) {
    input.description = description || undefined;
  }
  if (provider !== originalValues?.provider) {
    input.provider = provider;
  }

  input.clientConfig = buildClientConfig(formData);
  return input;
}

/**
 * Type guard functions for safer type narrowing
 */
function isDeepSeekFormData(data: ProviderFormData): data is DeepSeekFormData {
  return data.provider.toLowerCase() === "deepseek" && data.sdk === "OPENAI";
}

function isXAIFormData(data: ProviderFormData): data is XAIFormData {
  return data.provider.toLowerCase() === "xai" && data.sdk === "OPENAI";
}

function isOllamaFormData(data: ProviderFormData): data is OllamaFormData {
  return data.provider.toLowerCase() === "ollama" && data.sdk === "OPENAI";
}

function isOpenAIFormData(data: ProviderFormData): data is OpenAIFormData {
  return (
    data.sdk === "OPENAI" &&
    !isDeepSeekFormData(data) &&
    !isXAIFormData(data) &&
    !isOllamaFormData(data)
  );
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

/**
 * Builds the nested client config structure based on provider type
 * Uses type guards for safe type narrowing instead of type assertions
 */
function buildClientConfig(formData: ProviderFormData) {
  // Check provider-specific variants first (DeepSeek, xAI, Ollama use OpenAI SDK)
  if (isDeepSeekFormData(formData)) {
    const apiKey = toStringValueInput(
      formData.deepseek_api_key,
      formData.deepseek_api_key_is_env_var
    );

    return {
      deepseek: {
        deepseekAuthenticationMethod: apiKey ? { apiKey } : {},
        openaiClientKwargs: compactObject({
          baseUrl: toStringValueInput(
            formData.deepseek_base_url,
            formData.deepseek_base_url_is_env_var
          ),
          organization: toStringValueInput(
            formData.deepseek_organization,
            formData.deepseek_organization_is_env_var
          ),
          project: toStringValueInput(
            formData.deepseek_project,
            formData.deepseek_project_is_env_var
          ),
          defaultHeaders: parseJsonField(formData.deepseek_default_headers),
        }),
      },
    };
  }

  if (isXAIFormData(formData)) {
    const apiKey = toStringValueInput(
      formData.xai_api_key,
      formData.xai_api_key_is_env_var
    );

    return {
      xai: {
        xaiAuthenticationMethod: apiKey ? { apiKey } : {},
        openaiClientKwargs: compactObject({
          baseUrl: toStringValueInput(
            formData.xai_base_url,
            formData.xai_base_url_is_env_var
          ),
          organization: toStringValueInput(
            formData.xai_organization,
            formData.xai_organization_is_env_var
          ),
          project: toStringValueInput(
            formData.xai_project,
            formData.xai_project_is_env_var
          ),
          defaultHeaders: parseJsonField(formData.xai_default_headers),
        }),
      },
    };
  }

  if (isOllamaFormData(formData)) {
    return {
      ollama: {
        openaiClientKwargs: compactObject({
          baseUrl: toStringValueInput(
            formData.ollama_base_url,
            formData.ollama_base_url_is_env_var
          ),
          organization: toStringValueInput(
            formData.ollama_organization,
            formData.ollama_organization_is_env_var
          ),
          project: toStringValueInput(
            formData.ollama_project,
            formData.ollama_project_is_env_var
          ),
          defaultHeaders: parseJsonField(formData.ollama_default_headers),
        }),
      },
    };
  }

  // Now handle standard SDK-based providers
  if (isOpenAIFormData(formData)) {
    const apiKey = toStringValueInput(
      formData.openai_api_key,
      formData.openai_api_key_is_env_var
    );

    return {
      openai: {
        openaiAuthenticationMethod: apiKey ? { apiKey } : {},
        openaiClientKwargs: compactObject({
          baseUrl: toStringValueInput(
            formData.openai_base_url,
            formData.openai_base_url_is_env_var
          ),
          organization: toStringValueInput(
            formData.openai_organization,
            formData.openai_organization_is_env_var
          ),
          project: toStringValueInput(
            formData.openai_project,
            formData.openai_project_is_env_var
          ),
          defaultHeaders: parseJsonField(formData.openai_default_headers),
        }),
      },
    };
  }

  if (isAzureOpenAIFormData(formData)) {
    let authMethod = {};

    // Add authentication based on method
    switch (formData.azure_auth_method) {
      case "api_key":
        authMethod = compactObject({
          apiKey: toStringValueInput(
            formData.azure_api_key,
            formData.azure_api_key_is_env_var
          ),
        });
        break;
      case "ad_token":
        authMethod = compactObject({
          azureAdToken: toStringValueInput(
            formData.azure_ad_token,
            formData.azure_ad_token_is_env_var
          ),
        });
        break;
      case "ad_token_provider":
        authMethod = compactObject({
          azureAdTokenProvider: compactObject({
            azureTenantId: toStringValueInput(
              formData.azure_tenant_id,
              formData.azure_tenant_id_is_env_var
            ),
            azureClientId: toStringValueInput(
              formData.azure_client_id,
              formData.azure_client_id_is_env_var
            ),
            azureClientSecret: toStringValueInput(
              formData.azure_client_secret,
              formData.azure_client_secret_is_env_var
            ),
            scope: toStringValueInput(
              formData.azure_scope,
              formData.azure_scope_is_env_var
            ),
          }),
        });
        break;
      default:
        throw new Error(
          `Unknown Azure authentication method: ${formData.azure_auth_method}`
        );
    }

    return {
      azureOpenai: {
        azureOpenaiAuthenticationMethod: authMethod,
        azureOpenaiClientKwargs: compactObject({
          azureEndpoint: toStringValueInput(
            formData.azure_endpoint,
            formData.azure_endpoint_is_env_var
          ),
          azureDeployment: toStringValueInput(
            formData.azure_deployment_name,
            formData.azure_deployment_name_is_env_var
          ),
          apiVersion: toStringValueInput(
            formData.azure_api_version,
            formData.azure_api_version_is_env_var
          ),
          defaultHeaders: parseJsonField(formData.azure_default_headers),
        }),
      },
    };
  }

  if (isAnthropicFormData(formData)) {
    const apiKey = toStringValueInput(
      formData.anthropic_api_key,
      formData.anthropic_api_key_is_env_var
    );

    return {
      anthropic: {
        anthropicAuthenticationMethod: apiKey ? { apiKey } : {},
        anthropicClientKwargs: compactObject({
          baseUrl: toStringValueInput(
            formData.anthropic_base_url,
            formData.anthropic_base_url_is_env_var
          ),
          defaultHeaders: parseJsonField(formData.anthropic_default_headers),
        }),
      },
    };
  }

  if (isAWSBedrockFormData(formData)) {
    const awsAccessKeyId = toStringValueInput(
      formData.aws_access_key_id,
      formData.aws_access_key_id_is_env_var
    );
    const awsSecretAccessKey = toStringValueInput(
      formData.aws_secret_access_key,
      formData.aws_secret_access_key_is_env_var
    );
    const awsSessionToken = toStringValueInput(
      formData.aws_session_token,
      formData.aws_session_token_is_env_var
    );

    return {
      awsBedrock: {
        awsBedrockAuthenticationMethod: {
          ...(awsAccessKeyId && { awsAccessKeyId }),
          ...(awsSecretAccessKey && { awsSecretAccessKey }),
          ...(awsSessionToken && { awsSessionToken }),
        },
        awsBedrockClientKwargs: compactObject({
          regionName: toStringValueInput(
            formData.aws_region,
            formData.aws_region_is_env_var
          ),
        }),
      },
    };
  }

  if (isGoogleGenAIFormData(formData)) {
    const apiKey = toStringValueInput(
      formData.google_api_key,
      formData.google_api_key_is_env_var
    );
    const baseUrl = toStringValueInput(
      formData.google_base_url,
      formData.google_base_url_is_env_var
    );
    const headers = parseJsonField(formData.google_headers);

    const httpOptions = compactObject({
      baseUrl,
      headers,
    });

    return {
      googleGenai: {
        googleGenaiAuthenticationMethod: apiKey ? { apiKey } : {},
        googleGenaiClientKwargs: httpOptions ? { httpOptions } : {},
      },
    };
  }

  // This should never happen due to discriminated union, but TypeScript needs it
  const _exhaustive: never = formData;
  throw new Error(
    `Unknown provider configuration: ${JSON.stringify(_exhaustive)}`
  );
}

/**
 * Serialize JSON value to string, returning undefined for null/undefined
 */
function serializeJsonField(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/**
 * Transform GraphQL config data into form initial values
 */
export function transformConfigToFormValues(
  provider: CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"]
): Partial<ProviderFormData> {
  const baseValues: Partial<ProviderFormData> = {
    name: provider.name,
    description: provider.description || "",
    provider: provider.provider,
  };

  const config = provider.config;
  if (!config) {
    return baseValues;
  }

  // Determine SDK type and transform config
  if (config.openaiAuthenticationMethod || config.openaiClientKwargs) {
    const apiKey = extractStringValue(
      config.openaiAuthenticationMethod?.apiKey
    );
    const baseUrl = extractStringValue(config.openaiClientKwargs?.baseUrl);
    const organization = extractStringValue(
      config.openaiClientKwargs?.organization
    );
    const project = extractStringValue(config.openaiClientKwargs?.project);

    return {
      ...baseValues,
      sdk: "OPENAI",
      openai_api_key: apiKey.value || "",
      openai_api_key_is_env_var: apiKey.isEnvVar,
      openai_base_url: baseUrl.value,
      openai_base_url_is_env_var: baseUrl.isEnvVar,
      openai_organization: organization.value,
      openai_organization_is_env_var: organization.isEnvVar,
      openai_project: project.value,
      openai_project_is_env_var: project.isEnvVar,
      openai_default_headers: serializeJsonField(
        config.openaiClientKwargs?.defaultHeaders
      ),
    };
  }

  if (
    config.azureOpenaiAuthenticationMethod &&
    config.azureOpenaiClientKwargs
  ) {
    const authMethod = config.azureOpenaiAuthenticationMethod;
    const kwargs = config.azureOpenaiClientKwargs;

    // Determine auth method based on what's present
    const authMethodType = authMethod.apiKey
      ? "api_key"
      : authMethod.azureAdToken
        ? "ad_token"
        : authMethod.azureAdTokenProvider
          ? "ad_token_provider"
          : "api_key"; // default fallback

    const endpoint = extractStringValue(kwargs.azureEndpoint);
    const deploymentName = extractStringValue(kwargs.azureDeployment);
    const apiVersion = extractStringValue(kwargs.apiVersion);
    const apiKey = extractStringValue(authMethod.apiKey);
    const adToken = extractStringValue(authMethod.azureAdToken);
    const tenantId = extractStringValue(
      authMethod.azureAdTokenProvider?.azureTenantId
    );
    const clientId = extractStringValue(
      authMethod.azureAdTokenProvider?.azureClientId
    );
    const clientSecret = extractStringValue(
      authMethod.azureAdTokenProvider?.azureClientSecret
    );
    const scope = extractStringValue(authMethod.azureAdTokenProvider?.scope);

    return {
      ...baseValues,
      sdk: "AZURE_OPENAI",
      azure_endpoint: endpoint.value,
      azure_endpoint_is_env_var: endpoint.isEnvVar,
      azure_deployment_name: deploymentName.value,
      azure_deployment_name_is_env_var: deploymentName.isEnvVar,
      azure_api_version: apiVersion.value,
      azure_api_version_is_env_var: apiVersion.isEnvVar,
      azure_auth_method: authMethodType,
      azure_api_key: apiKey.value,
      azure_api_key_is_env_var: apiKey.isEnvVar,
      azure_ad_token: adToken.value,
      azure_ad_token_is_env_var: adToken.isEnvVar,
      azure_tenant_id: tenantId.value,
      azure_tenant_id_is_env_var: tenantId.isEnvVar,
      azure_client_id: clientId.value,
      azure_client_id_is_env_var: clientId.isEnvVar,
      azure_client_secret: clientSecret.value,
      azure_client_secret_is_env_var: clientSecret.isEnvVar,
      azure_scope: scope.value,
      azure_scope_is_env_var: scope.isEnvVar,
      azure_default_headers: serializeJsonField(kwargs.defaultHeaders),
    };
  }

  if (config.anthropicAuthenticationMethod || config.anthropicClientKwargs) {
    const apiKey = extractStringValue(
      config.anthropicAuthenticationMethod?.apiKey
    );
    const baseUrl = extractStringValue(config.anthropicClientKwargs?.baseUrl);

    return {
      ...baseValues,
      sdk: "ANTHROPIC",
      anthropic_api_key: apiKey.value || "",
      anthropic_api_key_is_env_var: apiKey.isEnvVar,
      anthropic_base_url: baseUrl.value,
      anthropic_base_url_is_env_var: baseUrl.isEnvVar,
      anthropic_default_headers: serializeJsonField(
        config.anthropicClientKwargs?.defaultHeaders
      ),
    };
  }

  if (config.awsBedrockAuthenticationMethod || config.awsBedrockClientKwargs) {
    const region = extractStringValue(
      config.awsBedrockClientKwargs?.regionName
    );
    const accessKeyId = extractStringValue(
      config.awsBedrockAuthenticationMethod?.awsAccessKeyId
    );
    const secretAccessKey = extractStringValue(
      config.awsBedrockAuthenticationMethod?.awsSecretAccessKey
    );
    const sessionToken = extractStringValue(
      config.awsBedrockAuthenticationMethod?.awsSessionToken
    );

    return {
      ...baseValues,
      sdk: "AWS_BEDROCK",
      aws_region: region.value || "",
      aws_region_is_env_var: region.isEnvVar,
      aws_access_key_id: accessKeyId.value || "",
      aws_access_key_id_is_env_var: accessKeyId.isEnvVar,
      aws_secret_access_key: secretAccessKey.value || "",
      aws_secret_access_key_is_env_var: secretAccessKey.isEnvVar,
      aws_session_token: sessionToken.value,
      aws_session_token_is_env_var: sessionToken.isEnvVar,
    };
  }

  if (
    config.googleGenaiAuthenticationMethod ||
    config.googleGenaiClientKwargs
  ) {
    const httpOptions = config.googleGenaiClientKwargs?.httpOptions;
    const apiKey = extractStringValue(
      config.googleGenaiAuthenticationMethod?.apiKey
    );
    const baseUrl = extractStringValue(httpOptions?.baseUrl);

    return {
      ...baseValues,
      sdk: "GOOGLE_GENAI",
      google_api_key: apiKey.value || "",
      google_api_key_is_env_var: apiKey.isEnvVar,
      google_base_url: baseUrl.value,
      google_base_url_is_env_var: baseUrl.isEnvVar,
      google_headers: serializeJsonField(httpOptions?.headers),
    };
  }

  if (provider.provider === "xai") {
    const apiKey = extractStringValue(config.xaiAuthenticationMethod?.apiKey);
    // GraphQL flattens union types, so we need to use type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kwargs = config as any;
    const baseUrl = extractStringValue(kwargs.openaiClientKwargs?.baseUrl);
    const organization = extractStringValue(
      kwargs.openaiClientKwargs?.organization
    );
    const project = extractStringValue(kwargs.openaiClientKwargs?.project);

    return {
      ...baseValues,
      sdk: "OPENAI",
      provider: "xai",
      xai_api_key: apiKey.value || "",
      xai_api_key_is_env_var: apiKey.isEnvVar,
      xai_base_url: baseUrl.value,
      xai_base_url_is_env_var: baseUrl.isEnvVar,
      xai_organization: organization.value,
      xai_organization_is_env_var: organization.isEnvVar,
      xai_project: project.value,
      xai_project_is_env_var: project.isEnvVar,
      xai_default_headers: serializeJsonField(
        kwargs.openaiClientKwargs?.defaultHeaders
      ),
    };
  }

  if (provider.provider === "deepseek") {
    const apiKey = extractStringValue(
      config.deepseekAuthenticationMethod?.apiKey
    );
    // GraphQL flattens union types, so we need to use type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kwargs = config as any;
    const baseUrl = extractStringValue(kwargs.openaiClientKwargs?.baseUrl);
    const organization = extractStringValue(
      kwargs.openaiClientKwargs?.organization
    );
    const project = extractStringValue(kwargs.openaiClientKwargs?.project);

    return {
      ...baseValues,
      sdk: "OPENAI",
      provider: "deepseek",
      deepseek_api_key: apiKey.value || "",
      deepseek_api_key_is_env_var: apiKey.isEnvVar,
      deepseek_base_url: baseUrl.value,
      deepseek_base_url_is_env_var: baseUrl.isEnvVar,
      deepseek_organization: organization.value,
      deepseek_organization_is_env_var: organization.isEnvVar,
      deepseek_project: project.value,
      deepseek_project_is_env_var: project.isEnvVar,
      deepseek_default_headers: serializeJsonField(
        kwargs.openaiClientKwargs?.defaultHeaders
      ),
    };
  }

  if (provider.provider === "ollama") {
    // GraphQL flattens union types, so we need to use type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kwargs = config as any;
    const baseUrl = extractStringValue(kwargs.openaiClientKwargs?.baseUrl);
    const organization = extractStringValue(
      kwargs.openaiClientKwargs?.organization
    );
    const project = extractStringValue(kwargs.openaiClientKwargs?.project);

    return {
      ...baseValues,
      sdk: "OPENAI",
      provider: "ollama",
      ollama_base_url: baseUrl.value || "",
      ollama_base_url_is_env_var: baseUrl.isEnvVar,
      ollama_organization: organization.value,
      ollama_organization_is_env_var: organization.isEnvVar,
      ollama_project: project.value,
      ollama_project_is_env_var: project.isEnvVar,
      ollama_default_headers: serializeJsonField(
        kwargs.openaiClientKwargs?.defaultHeaders
      ),
    };
  }

  return baseValues;
}
