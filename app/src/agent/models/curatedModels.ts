import type { GenerativeProviderKey } from "@phoenix/components/generative/__generated__/ModelMenuQuery.graphql";

export type AgentBuiltInModelSelection = {
  provider: GenerativeProviderKey;
  modelName: string;
};

export type AgentModelSelection = AgentBuiltInModelSelection & {
  customProvider?: { id: string; name: string } | null;
};

export type AgentCuratedModelsConfig = {
  curatedBuiltInModels: readonly AgentBuiltInModelSelection[];
  defaultBuiltInModel: AgentBuiltInModelSelection;
};

/**
 * Frontend-owned assistant curation policy.
 *
 * This intentionally lives in the app layer rather than server config so the
 * assistant picker can be curated without changing the chat request contract.
 */
export const AGENT_CURATED_MODELS_CONFIG: AgentCuratedModelsConfig = {
  curatedBuiltInModels: [
    { provider: "ANTHROPIC", modelName: "claude-opus-4-7" },
    { provider: "ANTHROPIC", modelName: "claude-opus-4-6" },
    { provider: "ANTHROPIC", modelName: "claude-opus-4-5" },
    { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
    { provider: "ANTHROPIC", modelName: "claude-sonnet-4-5" },
    { provider: "OPENAI", modelName: "gpt-5.4" },
    { provider: "OPENAI", modelName: "gpt-5.4-mini" },
    { provider: "OPENAI", modelName: "gpt-5.5" },
  ],
  defaultBuiltInModel: { provider: "ANTHROPIC", modelName: "claude-opus-4-6" },
};

/**
 * Checks whether a built-in provider/model pair belongs to the assistant's
 * exact curated visible list.
 */
export function isCuratedAgentBuiltInModel({
  provider,
  modelName,
  curatedBuiltInModels,
}: AgentBuiltInModelSelection &
  Pick<AgentCuratedModelsConfig, "curatedBuiltInModels">): boolean {
  return curatedBuiltInModels.some(
    (model) => model.provider === provider && model.modelName === modelName
  );
}

/**
 * Returns the preferred assistant default when available, otherwise the first
 * curated built-in model. This keeps boot-time normalization deterministic.
 */
export function getDefaultOrFallbackAgentBuiltInModel({
  curatedBuiltInModels,
  defaultBuiltInModel,
}: Pick<
  AgentCuratedModelsConfig,
  "curatedBuiltInModels" | "defaultBuiltInModel"
>): AgentBuiltInModelSelection {
  const preferredDefault = curatedBuiltInModels.find(
    (model) =>
      model.provider === defaultBuiltInModel.provider &&
      model.modelName === defaultBuiltInModel.modelName
  );
  return preferredDefault ?? curatedBuiltInModels[0] ?? defaultBuiltInModel;
}

/**
 * Normalizes persisted or user-selected assistant model state.
 *
 * Custom providers are always preserved. Built-in selections must appear in
 * the curated visible model list; otherwise the assistant falls back to the
 * curated default.
 */
export function normalizeAgentModelMenuValue(
  value: AgentModelSelection,
  config: AgentCuratedModelsConfig
): AgentModelSelection {
  if (value.customProvider) {
    return value;
  }
  if (
    isCuratedAgentBuiltInModel({
      provider: value.provider,
      modelName: value.modelName,
      curatedBuiltInModels: config.curatedBuiltInModels,
    })
  ) {
    return value;
  }
  const fallback = getDefaultOrFallbackAgentBuiltInModel(config);
  return {
    provider: fallback.provider,
    modelName: fallback.modelName,
  };
}
