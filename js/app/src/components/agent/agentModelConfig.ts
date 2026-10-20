import { z } from "zod";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { AGENT_MODEL_CONFIG_STORAGE_BASE_KEY } from "@phoenix/constants/storageConstants";
import { modelProviderSchema } from "@phoenix/utils/generativeUtils";
import { scopeStorageKeyToBasename } from "@phoenix/utils/storageUtils";

/**
 * Resolves the agent model-config key, scoped to the deployment's root path
 * so co-hosted workspaces don't share the preference (see
 * {@link scopeStorageKeyToBasename}). Resolved at read/write time — the key
 * depends on `window.Config`, which isn't set at module load.
 */
export function resolveAgentModelStorageKey(): string {
  return scopeStorageKeyToBasename(AGENT_MODEL_CONFIG_STORAGE_BASE_KEY);
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

/**
 * The stable id of a model selection, used for picker row keys, recency
 * lookups and recent-model dedupe.
 *
 * @param params - the selection
 * @param params.provider - built-in provider key (the SDK's key for custom providers)
 * @param params.customProviderId - custom provider id, if any
 * @param params.modelName - the model id
 */
export function getAgentModelKey({
  provider,
  customProviderId,
  modelName,
}: {
  provider: string;
  customProviderId?: string | null;
  modelName: string;
}): string {
  const providerKey = customProviderId
    ? `custom:${customProviderId}`
    : provider;
  return `${providerKey}:${modelName}`;
}

/** {@link getAgentModelKey} for a picker value. */
export function getAgentModelKeyForValue(model: ModelMenuValue): string {
  return getAgentModelKey({
    provider: model.provider,
    customProviderId: model.customProvider?.id,
    modelName: model.modelName,
  });
}

/** How many recently picked models are kept. */
export const DEFAULT_RECENT_AGENT_MODELS_LIMIT = 5;

/** How many recent models the picker shows. */
export const DEFAULT_RECENT_AGENT_MODELS_SHOWN = 3;

const AGENT_RECENT_MODEL_SCHEMA = z.object({
  provider: modelProviderSchema,
  modelName: z.string().min(1),
  customProvider: z.object({ id: z.string(), name: z.string() }).optional(),
});

/**
 * A recently picked model, newest first in the store. Any model name is
 * allowed, so typed names that aren't in the catalog are kept too.
 */
export type AgentRecentModel = ModelMenuValue;

/**
 * Records a pick in the recent-models list: moves it to the front (dropping
 * any earlier entry for the same provider, custom provider and model name)
 * and keeps at most `limit` entries.
 *
 * @param params - inputs
 * @param params.recentModels - the current list, newest first
 * @param params.model - the model just picked
 * @param params.limit - max entries kept (default 5)
 */
export function addRecentAgentModel({
  recentModels,
  model,
  limit = DEFAULT_RECENT_AGENT_MODELS_LIMIT,
}: {
  recentModels: readonly AgentRecentModel[];
  model: ModelMenuValue;
  limit?: number;
}): AgentRecentModel[] {
  const key = getAgentModelKeyForValue(model);
  const entry: AgentRecentModel = {
    provider: model.provider,
    modelName: model.modelName,
    ...(model.customProvider && {
      customProvider: {
        id: model.customProvider.id,
        name: model.customProvider.name,
      },
    }),
  };
  return [
    entry,
    ...recentModels.filter(
      (recentModel) => getAgentModelKeyForValue(recentModel) !== key
    ),
  ].slice(0, limit);
}

/**
 * The recent models to show in the picker: newest first, without the current
 * model, at most `limit`.
 *
 * @param params - inputs
 * @param params.recentModels - the stored list, newest first
 * @param params.currentModel - the model currently selected, if any
 * @param params.limit - max entries returned (default 3)
 */
export function getRecentAgentModels({
  recentModels,
  currentModel,
  limit = DEFAULT_RECENT_AGENT_MODELS_SHOWN,
}: {
  recentModels: readonly AgentRecentModel[];
  currentModel?: ModelMenuValue | null;
  limit?: number;
}): AgentRecentModel[] {
  const currentKey = currentModel
    ? getAgentModelKeyForValue(currentModel)
    : null;
  return recentModels
    .filter(
      (recentModel) => getAgentModelKeyForValue(recentModel) !== currentKey
    )
    .slice(0, limit);
}

/**
 * Validates a persisted recent-models list, dropping malformed entries and
 * duplicates, so a stale or hand-edited blob can't break the picker.
 *
 * @param params - inputs
 * @param params.value - the rehydrated value
 * @param params.limit - max entries kept (default 5)
 */
export function normalizeRecentAgentModels({
  value,
  limit = DEFAULT_RECENT_AGENT_MODELS_LIMIT,
}: {
  value: unknown;
  limit?: number;
}): AgentRecentModel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seenKeys = new Set<string>();
  return value
    .flatMap((entry): AgentRecentModel[] => {
      const parsed = AGENT_RECENT_MODEL_SCHEMA.safeParse(entry);
      if (!parsed.success) {
        return [];
      }
      const key = getAgentModelKeyForValue(parsed.data);
      if (seenKeys.has(key)) {
        return [];
      }
      seenKeys.add(key);
      return [parsed.data];
    })
    .slice(0, limit);
}
