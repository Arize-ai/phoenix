import { describe, expect, it } from "vitest";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import {
  addRecentAgentModel,
  getAgentModelKey,
  getRecentAgentModels,
  normalizeRecentAgentModels,
} from "../agentModelConfig";

const OPUS: ModelMenuValue = {
  provider: "ANTHROPIC",
  modelName: "claude-opus-4-6",
};
const GPT: ModelMenuValue = { provider: "OPENAI", modelName: "gpt-5.4" };
const TYPED: ModelMenuValue = {
  provider: "OPENAI",
  modelName: "gpt-9-preview",
};
const CUSTOM_GPT: ModelMenuValue = {
  provider: "OPENAI",
  modelName: "gpt-5.4",
  customProvider: { id: "custom-acme", name: "Acme" },
};

function pick(models: readonly ModelMenuValue[]) {
  return models.reduce<ModelMenuValue[]>(
    (recentModels, model) => addRecentAgentModel({ recentModels, model }),
    []
  );
}

describe("getAgentModelKey", () => {
  it("separates custom providers from built-in ones", () => {
    expect(getAgentModelKey({ provider: "OPENAI", modelName: "gpt-5.4" })).toBe(
      "OPENAI:gpt-5.4"
    );
    expect(
      getAgentModelKey({
        provider: "OPENAI",
        customProviderId: "custom-acme",
        modelName: "gpt-5.4",
      })
    ).toBe("custom:custom-acme:gpt-5.4");
  });
});

describe("addRecentAgentModel", () => {
  it("puts the newest pick first", () => {
    expect(pick([OPUS, GPT, TYPED])).toEqual([TYPED, GPT, OPUS]);
  });

  it("dedupes by provider, custom provider and model name", () => {
    expect(pick([OPUS, GPT, CUSTOM_GPT, OPUS])).toEqual([
      OPUS,
      CUSTOM_GPT,
      GPT,
    ]);
    // Same id under another provider is a different entry
    expect(
      pick([OPUS, { provider: "AWS", modelName: OPUS.modelName }])
    ).toEqual([{ provider: "AWS", modelName: OPUS.modelName }, OPUS]);
  });

  it("keeps 5", () => {
    const models = Array.from({ length: 7 }, (_, index) => ({
      provider: "OPENAI" as const,
      modelName: `typed-${index}`,
    }));
    expect(pick(models).map((model) => model.modelName)).toEqual([
      "typed-6",
      "typed-5",
      "typed-4",
      "typed-3",
      "typed-2",
    ]);
  });

  it("refreshes a custom provider's name on a repeat pick", () => {
    const renamed = {
      ...CUSTOM_GPT,
      customProvider: { id: "custom-acme", name: "Acme v2" },
    };
    expect(pick([CUSTOM_GPT, renamed])).toEqual([renamed]);
  });

  it("ignores a pick with an empty model name", () => {
    expect(
      addRecentAgentModel({
        recentModels: [OPUS],
        model: { provider: "OPENAI", modelName: "" },
      })
    ).toEqual([OPUS]);
  });
});

describe("getRecentAgentModels", () => {
  it("returns the top 3, excluding the current model", () => {
    const recentModels = pick([CUSTOM_GPT, TYPED, GPT, OPUS]);
    expect(getRecentAgentModels({ recentModels })).toEqual([OPUS, GPT, TYPED]);
    expect(getRecentAgentModels({ recentModels, currentModel: OPUS })).toEqual([
      GPT,
      TYPED,
      CUSTOM_GPT,
    ]);
  });
});

describe("normalizeRecentAgentModels", () => {
  it("drops malformed entries and duplicates", () => {
    expect(
      normalizeRecentAgentModels({
        value: [
          OPUS,
          { provider: "NOT_A_PROVIDER", modelName: "x" },
          { provider: "OPENAI", modelName: "" },
          "garbage",
          OPUS,
          CUSTOM_GPT,
        ],
      })
    ).toEqual([OPUS, CUSTOM_GPT]);
    expect(normalizeRecentAgentModels({ value: { not: "an array" } })).toEqual(
      []
    );
  });
});
