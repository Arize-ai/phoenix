import { describe, expect, it } from "vitest";

import {
  AGENT_CURATED_BUILT_IN_MODELS,
  getAgentCuratedModelDisplayName,
  getCuratedBuiltInModels,
  isAgentCuratedModelSelection,
} from "../agentCuratedModels";

const FIRST_CURATED_MODEL = AGENT_CURATED_BUILT_IN_MODELS[0];
const LAST_CURATED_MODEL = AGENT_CURATED_BUILT_IN_MODELS.at(-1)!;
const CUSTOM_PROVIDER = { id: "custom-provider-id", name: "Custom Provider" };

describe("agent curated models", () => {
  it.each(AGENT_CURATED_BUILT_IN_MODELS)(
    "detects curated built-in model $modelName",
    ({ provider, modelName }) => {
      expect(isAgentCuratedModelSelection({ provider, modelName })).toBe(true);
    }
  );

  it("treats built-in models outside the recommended list as untested", () => {
    expect(
      isAgentCuratedModelSelection({
        provider: "OPENAI",
        modelName: "gpt-4o",
      })
    ).toBe(false);
  });

  it("treats custom provider models as untested, even with a curated name", () => {
    expect(
      isAgentCuratedModelSelection({
        provider: FIRST_CURATED_MODEL.provider,
        modelName: FIRST_CURATED_MODEL.modelName,
        customProvider: CUSTOM_PROVIDER,
      })
    ).toBe(false);
  });

  it("filters curated models against registered playground models, in curated order", () => {
    expect(
      getCuratedBuiltInModels([
        {
          providerKey: LAST_CURATED_MODEL.provider,
          name: LAST_CURATED_MODEL.modelName,
        },
        { providerKey: "OPENAI", name: "gpt-4o" },
        {
          providerKey: FIRST_CURATED_MODEL.provider,
          name: FIRST_CURATED_MODEL.modelName,
        },
      ])
    ).toEqual([
      {
        provider: FIRST_CURATED_MODEL.provider,
        modelName: FIRST_CURATED_MODEL.modelName,
      },
      {
        provider: LAST_CURATED_MODEL.provider,
        modelName: LAST_CURATED_MODEL.modelName,
      },
    ]);
  });
});

describe("agent curated model display names", () => {
  it.each(AGENT_CURATED_BUILT_IN_MODELS)(
    "returns the display name of $modelName",
    ({ provider, modelName, displayName }) => {
      expect(getAgentCuratedModelDisplayName({ provider, modelName })).toBe(
        displayName
      );
    }
  );

  it("has no display name for other or custom provider models", () => {
    expect(
      getAgentCuratedModelDisplayName({
        provider: "OPENAI",
        modelName: "gpt-4o",
      })
    ).toBeNull();
    expect(
      getAgentCuratedModelDisplayName({
        provider: FIRST_CURATED_MODEL.provider,
        modelName: FIRST_CURATED_MODEL.modelName,
        customProvider: CUSTOM_PROVIDER,
      })
    ).toBeNull();
    // Same id under another provider isn't curated
    expect(
      getAgentCuratedModelDisplayName({
        provider: "AWS",
        modelName: FIRST_CURATED_MODEL.modelName,
      })
    ).toBeNull();
  });
});
