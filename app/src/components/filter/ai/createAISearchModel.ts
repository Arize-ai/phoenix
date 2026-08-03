import type { LanguageModel } from "ai";

import { createBrowserModel } from "@phoenix/components/generative/browserAI";

import { createServerModel } from "./serverModel";
import type { AISearchModelConfig } from "./types";

/**
 * Resolves a model configuration to a runnable AI SDK model. The two kinds
 * converge here — everything downstream (prompting, streaming, validation)
 * is identical regardless of where the model runs.
 */
export async function createAISearchModel({
  config,
}: {
  config: AISearchModelConfig;
}): Promise<LanguageModel> {
  if (config.kind === "browser") {
    return createBrowserModel();
  }
  return createServerModel(config);
}
