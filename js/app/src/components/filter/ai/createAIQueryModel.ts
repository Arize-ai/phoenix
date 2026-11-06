import type { LanguageModel } from "ai";

import { createBrowserModel } from "@phoenix/components/generative/browserAI";

import { createServerModel } from "./serverModel";
import type { AIQueryModelConfig } from "./types";

/**
 * Resolves a model configuration to a runnable AI SDK model. The two kinds
 * converge here — everything downstream (prompting, streaming, validation)
 * is identical regardless of where the model runs.
 */
export async function createAIQueryModel({
  config,
}: {
  config: AIQueryModelConfig;
}): Promise<LanguageModel> {
  if (config.kind === "browser") {
    return createBrowserModel();
  }
  return createServerModel(config);
}
