import { ProviderToCredentialsConfigMap } from "@phoenix/constants/generativeConstants";
import type { CredentialsProps } from "@phoenix/store/credentialsStore";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  GenerativeModelSDK,
  GenerativeProviderKey,
} from "./__generated__/useModelMenuDataQuery.graphql";

const GENERATIVE_MODEL_SDK_TO_PROVIDER_KEY: Record<
  GenerativeModelSDK,
  GenerativeProviderKey
> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
};

export function getProviderKeyForGenerativeModelSDK(
  sdk: GenerativeModelSDK
): GenerativeProviderKey {
  return GENERATIVE_MODEL_SDK_TO_PROVIDER_KEY[sdk];
}

/**
 * Browser-local credential values keyed by provider, then by env var name.
 */
export type LocalProviderCredentials = CredentialsProps;

/**
 * Minimal provider info needed to determine readiness.
 */
export type ProviderCredentialStatus = {
  key: string;
  dependenciesInstalled: boolean;
  credentialsSet: boolean;
};

/**
 * Providers that can authenticate through an ambient default credential chain
 * with no credentials visible to Phoenix — an attached IAM role for AWS
 * Bedrock, or DefaultAzureCredential (Managed Identity / AD token) for Azure
 * OpenAI. The server cannot detect these, so absence of explicit credentials
 * does not mean the provider is unusable.
 */
const PROVIDERS_WITH_DEFAULT_CREDENTIAL_CHAIN: ReadonlySet<ModelProvider> =
  new Set(["AWS", "AZURE_OPENAI"]);

export function providerSupportsDefaultCredentialChain({
  providerKey,
}: {
  providerKey: string;
}): boolean {
  return (
    isModelProvider(providerKey) &&
    PROVIDERS_WITH_DEFAULT_CREDENTIAL_CHAIN.has(providerKey)
  );
}

/**
 * Whether a provider requires any credentials at all.
 * Unknown providers are assumed to require credentials.
 */
export function providerRequiresCredentials({
  providerKey,
}: {
  providerKey: string;
}): boolean {
  if (!isModelProvider(providerKey)) {
    return true;
  }
  return ProviderToCredentialsConfigMap[providerKey].length > 0;
}

/**
 * Whether the browser-local credential store satisfies every required
 * credential for the provider.
 */
export function hasRequiredLocalCredentials({
  providerKey,
  localCredentials,
}: {
  providerKey: string;
  localCredentials: LocalProviderCredentials;
}): boolean {
  if (!isModelProvider(providerKey)) {
    return false;
  }
  const requirements = ProviderToCredentialsConfigMap[providerKey].filter(
    (requirement) => requirement.isRequired
  );
  if (!requirements.length) {
    return false;
  }
  const stored = localCredentials[providerKey];
  return requirements.every((requirement) =>
    Boolean(stored?.[requirement.envVarName]?.trim())
  );
}

/**
 * Whether the provider's credentials are explicitly satisfied on the server
 * or in the browser.
 */
function hasExplicitCredentials({
  provider,
  localCredentials,
}: {
  provider: ProviderCredentialStatus;
  localCredentials: LocalProviderCredentials;
}): boolean {
  return (
    provider.credentialsSet ||
    hasRequiredLocalCredentials({
      providerKey: provider.key,
      localCredentials,
    })
  );
}

/**
 * Whether the provider needs credentials before it can be used: it requires
 * credentials and none are explicitly set on the server or in the browser.
 * Default-credential-chain providers (AWS Bedrock, Azure OpenAI) still count
 * — ambient credentials cannot be detected, so the hint errs on the side of
 * pointing the user at configuration.
 */
export function providerNeedsCredentials({
  provider,
  localCredentials,
}: {
  provider: ProviderCredentialStatus;
  localCredentials: LocalProviderCredentials;
}): boolean {
  return (
    providerRequiresCredentials({ providerKey: provider.key }) &&
    !hasExplicitCredentials({ provider, localCredentials })
  );
}

/**
 * Whether a provider is ready to use: its server dependencies are installed
 * and its credentials are satisfied on the server or in the browser.
 * Providers with no credential requirements (e.g. Ollama) are always ready.
 * Providers that fall back to a default credential chain (AWS Bedrock, Azure
 * OpenAI) are ready whenever their dependencies are installed, since ambient
 * credentials cannot be detected.
 */
export function isProviderReady({
  provider,
  localCredentials,
}: {
  provider: ProviderCredentialStatus;
  localCredentials: LocalProviderCredentials;
}): boolean {
  return (
    provider.dependenciesInstalled &&
    (providerSupportsDefaultCredentialChain({ providerKey: provider.key }) ||
      hasExplicitCredentials({ provider, localCredentials }))
  );
}

/**
 * Whether the user has explicitly provisioned credentials for the provider,
 * regardless of whether its server dependencies are installed.
 * Providers that require no credentials are always ready but never count as
 * provisioned — otherwise they would mask the "no credentials yet" state.
 * Likewise, default-credential-chain providers count only when credentials
 * are explicitly set.
 */
export function isProviderProvisioned({
  provider,
  localCredentials,
}: {
  provider: ProviderCredentialStatus;
  localCredentials: LocalProviderCredentials;
}): boolean {
  return (
    providerRequiresCredentials({ providerKey: provider.key }) &&
    hasExplicitCredentials({ provider, localCredentials })
  );
}

export function applyBedrockModelPrefix({
  modelName,
  prefix,
}: {
  modelName: string;
  prefix: string;
}): string {
  const prefixDot = `${prefix}.`;
  return modelName.startsWith(prefixDot)
    ? modelName
    : `${prefixDot}${modelName}`;
}
