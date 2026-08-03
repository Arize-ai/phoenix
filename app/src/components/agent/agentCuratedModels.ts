import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import type { GenerativeProviderKey } from "@phoenix/components/generative/useModelMenuData";

/**
 * Capability tier tags for the curated agent model list. Each curated model
 * is labeled with one tag to help users pick a model for their use case.
 */
export type AgentModelTag = "fastest" | "balanced" | "advanced";

export type AgentModelTagInfo = {
  readonly label: string;
  readonly description: string;
};

export const AGENT_MODEL_TAG_INFO: Record<AgentModelTag, AgentModelTagInfo> = {
  fastest: {
    label: "Fastest",
    description:
      "Fast, low-cost models for quick questions and lightweight tasks.",
  },
  balanced: {
    label: "Balanced",
    description:
      "Strong reasoning at reasonable cost — a good default for most investigations.",
  },
  advanced: {
    label: "Advanced",
    description:
      "Frontier models for the hardest, open-ended problems. Slower and pricier.",
  },
};

export type AgentBuiltInModelSelection = {
  provider: GenerativeProviderKey;
  modelName: string;
};

export type AgentCuratedModel = AgentBuiltInModelSelection & {
  tag: AgentModelTag;
};

export type AgentPlaygroundModel = {
  readonly name: string;
  readonly providerKey: GenerativeProviderKey;
};

export const AGENT_CURATED_BUILT_IN_MODELS: readonly AgentCuratedModel[] = [
  { provider: "ANTHROPIC", modelName: "claude-fable-5", tag: "advanced" },
  { provider: "ANTHROPIC", modelName: "claude-opus-5", tag: "balanced" },
  { provider: "ANTHROPIC", modelName: "claude-sonnet-5", tag: "fastest" },
  { provider: "OPENAI", modelName: "gpt-5.6-sol", tag: "advanced" },
  { provider: "OPENAI", modelName: "gpt-5.6-terra", tag: "balanced" },
  { provider: "OPENAI", modelName: "gpt-5.6-luna", tag: "fastest" },
  { provider: "GOOGLE", modelName: "gemini-3.6-flash", tag: "balanced" },
  { provider: "GOOGLE", modelName: "gemini-3.5-flash-lite", tag: "fastest" },
];

export function isAgentCuratedBuiltInModel({
  provider,
  modelName,
}: AgentBuiltInModelSelection): boolean {
  return AGENT_CURATED_BUILT_IN_MODELS.some(
    (curatedModel) =>
      curatedModel.provider === provider && curatedModel.modelName === modelName
  );
}

export function getCuratedBuiltInModels(
  playgroundModels: readonly AgentPlaygroundModel[]
): AgentCuratedModel[] {
  return AGENT_CURATED_BUILT_IN_MODELS.filter(({ provider, modelName }) =>
    playgroundModels.some(
      (playgroundModel) =>
        playgroundModel.providerKey === provider &&
        playgroundModel.name === modelName
    )
  );
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
