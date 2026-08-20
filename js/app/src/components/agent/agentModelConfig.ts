import { z } from "zod";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { modelProviderSchema } from "@phoenix/utils/generativeUtils";
import { scopeStorageKeyToBasename } from "@phoenix/utils/storageUtils";

const BASE_AGENT_MODEL_STORAGE_KEY =
  "__experimental__arize-phoenix-agent-config";

/**
 * Resolves the agent model-config key, scoped to the deployment's root path
 * so co-hosted workspaces don't share the preference (see
 * {@link scopeStorageKeyToBasename}). Resolved at read/write time — the key
 * depends on `window.Config`, which isn't set at module load.
 */
export function resolveAgentModelStorageKey(): string {
  return scopeStorageKeyToBasename(BASE_AGENT_MODEL_STORAGE_KEY);
}

const AGENT_MODEL_CONFIG_SCHEMA = z.object({
  provider: modelProviderSchema,
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
    const raw = localStorage.getItem(resolveAgentModelStorageKey());
    if (!raw) {
      return null;
    }
    return AGENT_MODEL_CONFIG_SCHEMA.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
