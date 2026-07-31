import type { LanguageModel } from "ai";

import {
  ModelProviders,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";

/**
 * The credentials stored in the browser for one provider, keyed by env var
 * name — the shape held by the credentials store.
 */
export type ProviderCredentials = Record<string, string | null>;

const OPENAI_COMPATIBLE_PROVIDERS = [
  "DEEPSEEK",
  "XAI",
  "GROQ",
  "CEREBRAS",
  "FIREWORKS",
  "MOONSHOT",
  "PERPLEXITY",
  "TOGETHER",
  "OLLAMA",
] as const satisfies readonly ModelProvider[];

type OpenAICompatibleProviderKey = (typeof OPENAI_COMPATIBLE_PROVIDERS)[number];

/**
 * Providers whose HTTP surface is OpenAI-compatible, mapped to their API
 * base URL. One adapter serves them all.
 */
const openAICompatibleBaseURLs: Record<OpenAICompatibleProviderKey, string> = {
  DEEPSEEK: "https://api.deepseek.com/v1",
  XAI: "https://api.x.ai/v1",
  GROQ: "https://api.groq.com/openai/v1",
  CEREBRAS: "https://api.cerebras.ai/v1",
  FIREWORKS: "https://api.fireworks.ai/inference/v1",
  MOONSHOT: "https://api.moonshot.ai/v1",
  PERPLEXITY: "https://api.perplexity.ai",
  TOGETHER: "https://api.together.xyz/v1",
  OLLAMA: "http://localhost:11434/v1",
};

function isOpenAICompatibleProvider(
  provider: ModelProvider
): provider is OpenAICompatibleProviderKey {
  return (OPENAI_COMPATIBLE_PROVIDERS as readonly ModelProvider[]).includes(
    provider
  );
}

/**
 * Providers AI search can call directly from the browser. Azure OpenAI and
 * AWS Bedrock are absent deliberately: both need per-deployment configuration
 * (resource endpoints, SigV4 signing) beyond an API key, which the
 * browser-held credentials don't carry.
 */
export const AI_SEARCH_PROVIDERS: ModelProvider[] = [
  "OPENAI",
  "ANTHROPIC",
  "GOOGLE",
  ...OPENAI_COMPATIBLE_PROVIDERS,
];

export function isAISearchProvider(provider: ModelProvider): boolean {
  return AI_SEARCH_PROVIDERS.includes(provider);
}

/**
 * Reads the provider's (first) required API key from the browser-held
 * credentials, throwing a message that tells the user what to configure
 * rather than letting the provider's 401 surface raw.
 */
function requireApiKey(
  provider: ModelProvider,
  credentials: ProviderCredentials | undefined
): string | undefined {
  const requirement = ProviderToCredentialsConfigMap[provider].find(
    (config) => config.isRequired
  );
  if (!requirement) {
    return undefined;
  }
  const value = credentials?.[requirement.envVarName];
  if (!value) {
    throw new Error(
      `${ModelProviders[provider]} requires ${requirement.envVarName}. Add it to your provider credentials.`
    );
  }
  return value;
}

/**
 * Creates an AI SDK model that calls the provider directly from the browser
 * using locally stored credentials. Provider SDKs load on demand so none of
 * them weigh down the main bundle.
 */
export async function createProviderModel({
  provider,
  modelName,
  credentials,
}: {
  provider: ModelProvider;
  modelName: string;
  credentials: ProviderCredentials | undefined;
}): Promise<LanguageModel> {
  switch (provider) {
    case "OPENAI": {
      const apiKey = requireApiKey(provider, credentials);
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey })(modelName);
    }
    case "ANTHROPIC": {
      const apiKey = requireApiKey(provider, credentials);
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({
        apiKey,
        // Anthropic rejects browser-origin requests unless explicitly opted
        // in; the key never leaves this user's browser
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      })(modelName);
    }
    case "GOOGLE": {
      const apiKey = requireApiKey(provider, credentials);
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey })(modelName);
    }
    default: {
      if (!isOpenAICompatibleProvider(provider)) {
        throw new Error(
          `${ModelProviders[provider]} is not supported for AI search`
        );
      }
      const baseURL = openAICompatibleBaseURLs[provider];
      const apiKey = requireApiKey(provider, credentials);
      const { createOpenAICompatible } =
        await import("@ai-sdk/openai-compatible");
      return createOpenAICompatible({
        name: ModelProviders[provider],
        baseURL,
        apiKey,
      })(modelName);
    }
  }
}
