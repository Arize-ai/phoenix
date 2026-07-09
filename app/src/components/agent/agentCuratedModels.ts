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

export const AGENT_CURATED_BUILT_IN_MODELS: readonly AgentBuiltInModelSelection[] =
  [
    { provider: "ANTHROPIC", modelName: "claude-fable-5" },
    { provider: "ANTHROPIC", modelName: "claude-opus-4-8" },
    { provider: "ANTHROPIC", modelName: "claude-opus-4-6" },
    { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
    { provider: "OPENAI", modelName: "gpt-5.6-sol" },
    { provider: "OPENAI", modelName: "gpt-5.4" },
    { provider: "OPENAI", modelName: "gpt-5.4-mini" },
    { provider: "OPENAI", modelName: "gpt-5.5" },
    { provider: "GOOGLE", modelName: "gemini-3.1-pro-preview" },
    { provider: "GOOGLE", modelName: "gemini-3.5-flash" },
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
): AgentBuiltInModelSelection[] {
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
