import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";

export type AgentBuiltInModelSelection = {
  provider: GenerativeProviderKey;
  modelName: string;
};

export type AgentPlaygroundModel = {
  readonly name: string;
  readonly providerKey: GenerativeProviderKey;
};

/**
 * A curated built-in model with the human-readable name the PXI picker shows
 * in place of the raw id.
 */
export type AgentCuratedBuiltInModel = AgentBuiltInModelSelection & {
  displayName: string;
};

/**
 * The models PXI recommends, in display order. Only these get display names;
 * every other model is shown by its raw id.
 */
export const AGENT_CURATED_BUILT_IN_MODELS: readonly AgentCuratedBuiltInModel[] =
  [
    {
      provider: "ANTHROPIC",
      modelName: "claude-fable-5-1",
      displayName: "Claude Fable 5.1",
    },
    {
      provider: "ANTHROPIC",
      modelName: "claude-opus-5",
      displayName: "Claude Opus 5",
    },
    {
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
    },
    {
      provider: "ANTHROPIC",
      modelName: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
    },
    {
      provider: "OPENAI",
      modelName: "gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
    },
    {
      provider: "OPENAI",
      modelName: "gpt-5.4-mini",
      displayName: "GPT-5.4 mini",
    },
    { provider: "OPENAI", modelName: "gpt-5.5", displayName: "GPT-5.5" },
    {
      provider: "GOOGLE",
      modelName: "gemini-3.7-flash",
      displayName: "Gemini 3.7 Flash",
    },
    {
      provider: "GOOGLE",
      modelName: "gemini-3.1-pro-preview",
      displayName: "Gemini 3.1 Pro (preview)",
    },
  ];

function findAgentCuratedBuiltInModel({
  provider,
  modelName,
}: AgentBuiltInModelSelection): AgentCuratedBuiltInModel | undefined {
  return AGENT_CURATED_BUILT_IN_MODELS.find(
    (curatedModel) =>
      curatedModel.provider === provider && curatedModel.modelName === modelName
  );
}

export function isAgentCuratedBuiltInModel({
  provider,
  modelName,
}: AgentBuiltInModelSelection): boolean {
  return findAgentCuratedBuiltInModel({ provider, modelName }) != null;
}

export function getCuratedBuiltInModels(
  playgroundModels: readonly AgentPlaygroundModel[]
): AgentBuiltInModelSelection[] {
  return AGENT_CURATED_BUILT_IN_MODELS.filter(({ provider, modelName }) =>
    playgroundModels.some(
      (playgroundModel) =>
        playgroundModel.providerKey === provider &&
        playgroundModel.name === modelName
    )
  ).map(({ provider, modelName }) => ({ provider, modelName }));
}

export function isAgentCuratedModelSelection(
  model: ModelMenuValue | null | undefined
): boolean {
  if (!model || model.customProvider) {
    return false;
  }
  return isAgentCuratedBuiltInModel({
    provider: model.provider,
    modelName: model.modelName,
  });
}

/**
 * The display name of a curated model (e.g. "Claude Opus 4.6"), or null for
 * custom provider models and built-in models outside the curated list.
 */
export function getAgentCuratedModelDisplayName(
  model: ModelMenuValue | null | undefined
): string | null {
  if (!model || model.customProvider) {
    return null;
  }
  return (
    findAgentCuratedBuiltInModel({
      provider: model.provider,
      modelName: model.modelName,
    })?.displayName ?? null
  );
}

/**
 * The label to show for a model: its curated display name when it has one,
 * otherwise the raw model id.
 */
export function getAgentModelLabel(model: ModelMenuValue): string {
  return getAgentCuratedModelDisplayName(model) ?? model.modelName;
}
