import type { LanguageModel } from "ai";

import { createBrowserModel } from "./browserModel";
import type { ProviderCredentials } from "./providerModels";
import { createProviderModel } from "./providerModels";
import type { AISearchModelConfig } from "./types";

/**
 * Resolves a model configuration to a runnable AI SDK model. The two kinds
 * converge here — everything downstream (prompting, streaming, validation)
 * is identical regardless of where the model runs.
 */
export async function createAISearchModel({
  config,
  credentials,
}: {
  config: AISearchModelConfig;
  credentials?: Partial<Record<ModelProvider, ProviderCredentials>>;
}): Promise<LanguageModel> {
  if (config.kind === "browser") {
    return createBrowserModel();
  }
  return createProviderModel({
    provider: config.provider,
    modelName: config.modelName,
    credentials: credentials?.[config.provider],
  });
}
