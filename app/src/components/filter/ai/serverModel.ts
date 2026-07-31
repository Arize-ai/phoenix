import type { LanguageModel } from "ai";

import { prependBasename } from "@phoenix/utils/routingUtils";

import type { AISearchServerModelConfig } from "./types";

/**
 * Encodes a server model config as the model string the Phoenix server's
 * OpenAI-compatible `/v1/chat/completions` endpoint understands:
 * `{provider}:{model_name}` for built-in providers and
 * `custom:{provider_id}:{model_name}` for stored custom provider records.
 * The server splits on the first colon(s), so model names containing colons
 * (e.g. `llama3:8b`) survive intact.
 */
export function toServerModelId(config: AISearchServerModelConfig): string {
  if (config.source === "custom") {
    return `custom:${config.providerId}:${config.modelName}`;
  }
  return `${config.provider.toLowerCase()}:${config.modelName}`;
}

/**
 * Creates an AI SDK model that calls the Phoenix server's OpenAI-compatible
 * chat completions proxy. Credentials are resolved on the server, and the
 * browser's same-origin cookies carry authentication — no key ever reaches
 * this client. The adapter loads on demand so it doesn't weigh down the
 * main bundle.
 */
export async function createServerModel(
  config: AISearchServerModelConfig
): Promise<LanguageModel> {
  if (config.modelName.trim() === "") {
    throw new Error("Choose a model name in the AI search settings.");
  }
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const baseURL = new URL(
    prependBasename("/v1"),
    window.location.origin
  ).toString();
  return createOpenAICompatible({ name: "phoenix", baseURL })(
    toServerModelId(config)
  );
}
