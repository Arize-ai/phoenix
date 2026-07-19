import type { GenerativeProviderKey } from "./__generated__/useModelMenuDataQuery.graphql";

export type CuratedModel = {
  provider: GenerativeProviderKey;
  modelName: string;
};

/**
 * A small set of flagship models to surface in the model picker when the user
 * has not provisioned credentials for any provider.
 */
export const CURATED_MODELS: readonly CuratedModel[] = [
  { provider: "OPENAI", modelName: "gpt-5.6-luna" },
  { provider: "OPENAI", modelName: "gpt-5.4-mini" },
  { provider: "ANTHROPIC", modelName: "claude-fable-5" },
  { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
  { provider: "GOOGLE", modelName: "gemini-3.1-pro-preview" },
  { provider: "GOOGLE", modelName: "gemini-3.5-flash" },
];

/**
 * Returns the curated models that the server actually reports as available
 * playground models, so the list never advertises a model that cannot be
 * selected.
 */
export function getCuratedModels({
  playgroundModels,
}: {
  playgroundModels: readonly {
    readonly name: string;
    readonly providerKey: string;
  }[];
}): CuratedModel[] {
  return CURATED_MODELS.filter((curated) =>
    playgroundModels.some(
      (model) =>
        model.providerKey === curated.provider &&
        model.name === curated.modelName
    )
  );
}
