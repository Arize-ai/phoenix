import { assertUnreachable } from "@phoenix/typeUtils";

import type { CustomProviderDetailsDrawer_provider$data } from "./__generated__/CustomProviderDetailsDrawer_provider.graphql";
import type {
  ProviderDetail,
  ProviderDetailValue,
} from "./ProviderDetailsSection";

export type CustomProviderConfigData =
  CustomProviderDetailsDrawer_provider$data["config"];

const SDK_DEFAULT = "SDK default";
const NOT_SET = "Not set";

const OPENAI_API_TYPE_LABELS: Record<string, string> = {
  CHAT_COMPLETIONS: "Chat Completions",
  RESPONSES: "Responses",
};

function text(value: string): ProviderDetailValue {
  return { kind: "text", text: value };
}

function url(value: string | null | undefined): ProviderDetailValue {
  return value ? { kind: "code", text: value } : text(SDK_DEFAULT);
}

function optionalText(value: string | null | undefined): ProviderDetailValue {
  return text(value || NOT_SET);
}

function secret(value: string | null | undefined): ProviderDetailValue {
  return {
    kind: "status",
    isOk: Boolean(value),
    label: value ? "Set" : NOT_SET,
  };
}

/**
 * Header names only: header values often carry credentials, so the details
 * view doesn't show them.
 */
function listHeaderNames(headers: unknown): string[] {
  if (
    headers == null ||
    typeof headers !== "object" ||
    Array.isArray(headers)
  ) {
    return [];
  }
  return Object.keys(headers);
}

function headerNames(headers: unknown): ProviderDetailValue {
  return { kind: "tokens", items: listHeaderNames(headers), emptyText: "None" };
}

function apiType(value: string): ProviderDetailValue {
  return text(OPENAI_API_TYPE_LABELS[value] ?? value);
}

type ConfigOfType<T extends CustomProviderConfigData["__typename"]> = Extract<
  CustomProviderConfigData,
  { readonly __typename: T }
>;

function listOpenAIDetails(
  config: ConfigOfType<"OpenAICustomProviderConfig">
): ProviderDetail[] {
  const kwargs = config.openaiClientKwargs;
  return [
    { label: "API", value: apiType(config.openaiApiType) },
    { label: "Base URL", value: url(kwargs?.baseUrl) },
    {
      label: "API key",
      value: secret(config.openaiAuthenticationMethod.apiKey),
    },
    { label: "Organization", value: optionalText(kwargs?.organization) },
    { label: "Project", value: optionalText(kwargs?.project) },
    {
      label: "Default headers",
      value: headerNames(kwargs?.defaultHeaders),
    },
  ];
}

function listAzureAuthDetails(
  auth: ConfigOfType<"AzureOpenAICustomProviderConfig">["azureOpenaiAuthenticationMethod"]
): ProviderDetail[] {
  const tokenProvider = auth.azureAdTokenProvider;
  if (tokenProvider) {
    return [
      { label: "Authentication", value: text("Azure AD token provider") },
      { label: "Tenant ID", value: text(tokenProvider.azureTenantId) },
      { label: "Client ID", value: text(tokenProvider.azureClientId) },
      {
        label: "Client secret",
        value: secret(tokenProvider.azureClientSecret),
      },
      { label: "Scope", value: text(tokenProvider.scope) },
    ];
  }
  if (auth.defaultCredentials) {
    return [{ label: "Authentication", value: text("Default credentials") }];
  }
  return [
    { label: "Authentication", value: text("API key") },
    { label: "API key", value: secret(auth.apiKey) },
  ];
}

function listAzureOpenAIDetails(
  config: ConfigOfType<"AzureOpenAICustomProviderConfig">
): ProviderDetail[] {
  return [
    { label: "API", value: apiType(config.openaiApiType) },
    {
      label: "Endpoint",
      value: url(config.azureOpenaiClientKwargs.azureEndpoint),
    },
    ...listAzureAuthDetails(config.azureOpenaiAuthenticationMethod),
    {
      label: "Default headers",
      value: headerNames(config.azureOpenaiClientKwargs.defaultHeaders),
    },
  ];
}

function listAnthropicDetails(
  config: ConfigOfType<"AnthropicCustomProviderConfig">
): ProviderDetail[] {
  const kwargs = config.anthropicClientKwargs;
  return [
    { label: "Base URL", value: url(kwargs?.baseUrl) },
    {
      label: "API key",
      value: secret(config.anthropicAuthenticationMethod.apiKey),
    },
    {
      label: "Default headers",
      value: headerNames(kwargs?.defaultHeaders),
    },
  ];
}

function listAWSBedrockDetails(
  config: ConfigOfType<"AWSBedrockCustomProviderConfig">
): ProviderDetail[] {
  const accessKeys = config.awsBedrockAuthenticationMethod.accessKeys;
  const authDetails: ProviderDetail[] = accessKeys
    ? [
        { label: "Authentication", value: text("Access keys") },
        { label: "Access key ID", value: text(accessKeys.awsAccessKeyId) },
        {
          label: "Secret access key",
          value: secret(accessKeys.awsSecretAccessKey),
        },
        {
          label: "Session token",
          value: secret(accessKeys.awsSessionToken),
        },
      ]
    : [{ label: "Authentication", value: text("Default credentials") }];
  return [
    { label: "Region", value: text(config.awsBedrockClientKwargs.regionName) },
    {
      label: "Endpoint URL",
      value: url(config.awsBedrockClientKwargs.endpointUrl),
    },
    ...authDetails,
  ];
}

function listGoogleGenAIDetails(
  config: ConfigOfType<"GoogleGenAICustomProviderConfig">
): ProviderDetail[] {
  const httpOptions = config.googleGenaiClientKwargs?.httpOptions;
  return [
    { label: "Base URL", value: url(httpOptions?.baseUrl) },
    {
      label: "API key",
      value: secret(config.googleGenaiAuthenticationMethod.apiKey),
    },
    { label: "Headers", value: headerNames(httpOptions?.headers) },
  ];
}

function listTypeSafeDetails(
  config: ConfigOfType<"TypeSafeCustomProviderConfig">
): ProviderDetail[] {
  const kwargs = config.typesafeClientKwargs;
  return [
    { label: "Base URL", value: url(kwargs?.baseUrl) },
    {
      label: "API key",
      value: secret(config.typesafeAuthenticationMethod.apiKey),
    },
    {
      label: "Default headers",
      value: headerNames(kwargs?.defaultHeaders),
    },
  ];
}

/**
 * Lists a custom provider's connection settings for display, with secrets
 * shown only as set or not set.
 * @param config - the provider's config, as the details query returns it
 * @returns label and value pairs in the order the edit form shows them
 */
export function listCustomProviderConfigDetails(
  config: CustomProviderConfigData
): ProviderDetail[] {
  switch (config.__typename) {
    case "OpenAICustomProviderConfig":
      return listOpenAIDetails(config);
    case "AzureOpenAICustomProviderConfig":
      return listAzureOpenAIDetails(config);
    case "AnthropicCustomProviderConfig":
      return listAnthropicDetails(config);
    case "AWSBedrockCustomProviderConfig":
      return listAWSBedrockDetails(config);
    case "GoogleGenAICustomProviderConfig":
      return listGoogleGenAIDetails(config);
    case "TypeSafeCustomProviderConfig":
      return listTypeSafeDetails(config);
    case "UnparsableConfig":
    case "%other":
      return [];
    default:
      return assertUnreachable(config);
  }
}
