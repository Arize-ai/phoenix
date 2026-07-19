import { describe, expect, it } from "vitest";

import { CURATED_MODELS, getCuratedModels } from "../curatedModels";

describe("getCuratedModels", () => {
  it("only returns curated models that the server reports", () => {
    const playgroundModels = [
      { name: "gpt-5.6-luna", providerKey: "OPENAI" },
      { name: "claude-fable-5", providerKey: "ANTHROPIC" },
      { name: "some-other-model", providerKey: "OPENAI" },
    ];
    expect(getCuratedModels({ playgroundModels })).toEqual([
      { provider: "OPENAI", modelName: "gpt-5.6-luna" },
      { provider: "ANTHROPIC", modelName: "claude-fable-5" },
    ]);
  });

  it("requires the provider to match, not just the model name", () => {
    const playgroundModels = [
      { name: "gpt-5.6-luna", providerKey: "AZURE_OPENAI" },
    ];
    expect(getCuratedModels({ playgroundModels })).toEqual([]);
  });

  it("returns every curated model when the server reports them all", () => {
    const playgroundModels = CURATED_MODELS.map((model) => ({
      name: model.modelName,
      providerKey: model.provider,
    }));
    expect(getCuratedModels({ playgroundModels })).toEqual([...CURATED_MODELS]);
  });
});
