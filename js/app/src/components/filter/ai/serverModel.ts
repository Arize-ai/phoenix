import type { LanguageModel } from "ai";

import {
  createServerLanguageModel,
  encodeServerModelId,
} from "@phoenix/components/generative/serverLanguageModel";

import type { AIQueryServerModelConfig } from "./types";

/**
 * Encodes a server model config as the model string the Phoenix server's
 * OpenAI-compatible `/v1/chat/completions` endpoint understands (see
 * {@link encodeServerModelId} for the wire format).
 */
export function toServerModelId(config: AIQueryServerModelConfig): string {
  return encodeServerModelId(
    config.source === "custom"
      ? { customProviderId: config.providerId, modelName: config.modelName }
      : { provider: config.provider, modelName: config.modelName }
  );
}

/**
 * Creates the AI SDK model that AI query runs through the Phoenix server's
 * chat completions proxy.
 */
export async function createServerModel(
  config: AIQueryServerModelConfig
): Promise<LanguageModel> {
  if (config.modelName.trim() === "") {
    throw new Error("Choose a model name in the AI query settings.");
  }
  return createServerLanguageModel(toServerModelId(config));
}
