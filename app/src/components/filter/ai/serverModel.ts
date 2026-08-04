import type { LanguageModel } from "ai";

import { createServerLanguageModel } from "@phoenix/components/generative/serverLanguageModel";

import type { AIQueryServerModelConfig } from "./types";

/**
 * Encodes a server model config as the model string the Phoenix server's
 * OpenAI-compatible `/v1/chat/completions` endpoint understands:
 * `{provider}:{model_name}` for built-in providers and
 * `custom:{provider_id}:{model_name}` for stored custom provider records.
 * The server splits on the first colon(s), so model names containing colons
 * (e.g. `llama3:8b`) survive intact.
 */
export function toServerModelId(config: AIQueryServerModelConfig): string {
  if (config.source === "custom") {
    return `custom:${config.providerId}:${config.modelName}`;
  }
  return `${config.provider.toLowerCase()}:${config.modelName}`;
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
