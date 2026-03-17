import { z } from "zod";

import type { GenerativeProviderKey } from "@phoenix/components/generative/__generated__/ModelMenuQuery.graphql";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

export const AGENT_MODEL_LOCAL_STORAGE_KEY =
  "__experimental__arize-phoenix-agent-config";

const GENERATIVE_PROVIDER_KEY_SCHEMA = z.enum([
  "ANTHROPIC",
  "AWS",
  "AZURE_OPENAI",
  "CEREBRAS",
  "DEEPSEEK",
  "FIREWORKS",
  "GOOGLE",
  "GROQ",
  "MOONSHOT",
  "OLLAMA",
  "OPENAI",
  "PERPLEXITY",
  "TOGETHER",
  "XAI",
]) satisfies z.ZodType<GenerativeProviderKey>;

const AGENT_MODEL_CONFIG_SCHEMA = z.object({
  provider: GENERATIVE_PROVIDER_KEY_SCHEMA,
  model: z.string(),
  customProviderId: z.string().optional(),
});

export type AgentModelConfig = z.infer<typeof AGENT_MODEL_CONFIG_SCHEMA>;

export const DEFAULT_MODEL_MENU_VALUE: ModelMenuValue = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
};

/**
 * Converts a {@link ModelMenuValue} to the shape persisted in localStorage.
 */
export function toAgentModelConfig(model: ModelMenuValue): AgentModelConfig {
  return {
    provider: model.provider,
    model: model.modelName,
    customProviderId: model.customProvider?.id,
  };
}

/**
 * Converts a persisted {@link AgentModelConfig} back into a {@link ModelMenuValue}
 * for the model selector UI.
 */
export function toModelMenuValue(config: AgentModelConfig): ModelMenuValue {
  return {
    provider: config.provider,
    modelName: config.model,
    ...(config.customProviderId && {
      customProvider: { id: config.customProviderId, name: "" },
    }),
  };
}

/**
 * Reads and validates the saved agent model config from localStorage.
 * Returns `null` if nothing is stored or the value fails validation.
 */
export function getAgentModelConfigFromLocalStorage(): AgentModelConfig | null {
  try {
    const raw = localStorage.getItem(AGENT_MODEL_LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return AGENT_MODEL_CONFIG_SCHEMA.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
