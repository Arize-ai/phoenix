import type { PromptInvocationParametersReadableFragment$data } from "../../__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  getDefaultGoogleConfig,
  googleReadField,
  googleWriteField,
  googleConfigFromPromptInvocationParameters,
  googleConfigFromSpanInvocationParameters,
  googleConfigToPromptInput,
  parseGoogleConfig,
} from "../googleAdapter";

describe("getDefaultGoogleConfig", () => {
  it("creates the fresh Google playground defaults", () => {
    expect(getDefaultGoogleConfig()).toEqual({
      temperature: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      thinkingConfig: {
        thinkingLevel: "MEDIUM",
        includeThoughts: true,
      },
    });
  });
});

describe("parseGoogleConfig", () => {
  it("drops unknown keys and preserves canonical fields", () => {
    expect(
      parseGoogleConfig({
        temperature: 0.5,
        maxOutputTokens: 2048,
        stopSequences: ["END"],
        presencePenalty: 0.1,
        frequencyPenalty: 0.2,
        topP: 0.9,
        topK: 40,
        thinkingConfig: {
          thinkingBudget: 1024,
          thinkingLevel: "high",
          includeThoughts: true,
        },
        garbage: 1,
      })
    ).toEqual({
      temperature: 0.5,
      maxOutputTokens: 2048,
      stopSequences: ["END"],
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
      topP: 0.9,
      topK: 40,
      thinkingConfig: {
        thinkingBudget: 1024,
        thinkingLevel: "HIGH",
        includeThoughts: true,
      },
    });
  });

  it("drops malformed fields rather than failing the whole parse", () => {
    expect(
      parseGoogleConfig({
        temperature: "not a number",
        maxOutputTokens: "also bad",
        topP: 0.9,
      })
    ).toEqual({ topP: 0.9 });
  });

  it("falls back to an empty config for non-object input", () => {
    expect(parseGoogleConfig(null)).toEqual({});
    expect(parseGoogleConfig(undefined)).toEqual({});
    expect(parseGoogleConfig("string")).toEqual({});
    expect(parseGoogleConfig(42)).toEqual({});
  });
});

describe("googleConfigToPromptInput", () => {
  it("emits a minimal Google branch and omits undefined keys", () => {
    expect(googleConfigToPromptInput({ temperature: 0.5 })).toEqual({
      google: { temperature: 0.5 },
    });
  });

  it("emits thinkingConfig when set", () => {
    expect(
      googleConfigToPromptInput({
        thinkingConfig: {
          thinkingBudget: 1024,
          thinkingLevel: "HIGH",
        },
      }).google?.thinkingConfig
    ).toEqual({ thinkingBudget: 1024, thinkingLevel: "HIGH" });
  });
});

describe("googleConfigFromPromptInvocationParameters", () => {
  it("reads the Google branch into canonical config", () => {
    const data: PromptInvocationParametersReadableFragment$data = {
      __typename: "PromptGoogleInvocationParameters",
      temperature: 0.5,
      maxOutputTokens: 2048,
      stopSequences: ["END"],
      presencePenalty: null,
      frequencyPenalty: null,
      topP: 0.9,
      topK: 40,
      thinkingConfig: {
        thinkingBudget: 1024,
        thinkingLevel: "MEDIUM",
        includeThoughts: null,
      },
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(googleConfigFromPromptInvocationParameters(data)).toEqual({
      temperature: 0.5,
      maxOutputTokens: 2048,
      stopSequences: ["END"],
      topP: 0.9,
      topK: 40,
      thinkingConfig: { thinkingBudget: 1024, thinkingLevel: "MEDIUM" },
    });
  });
});

describe("googleConfigFromSpanInvocationParameters", () => {
  it("promotes response_json_schema + response_mime_type into responseFormat", () => {
    const { config, promoted } = googleConfigFromSpanInvocationParameters({
      temperature: 0.5,
      response_json_schema: { type: "object" },
      response_mime_type: "application/json",
    });
    expect(config).toEqual({ temperature: 0.5 });
    expect(promoted.responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: { name: "response", schema: { type: "object" } },
    });
  });

  it("does not promote when response_mime_type is missing", () => {
    const { promoted } = googleConfigFromSpanInvocationParameters({
      response_json_schema: { type: "object" },
    });
    expect(promoted.responseFormat).toBeUndefined();
  });
});

describe("google field-keyed read/write", () => {
  it("round-trips scalar leaves including the thinking sub-fields", () => {
    let config = googleWriteField({}, "temperature", 0.5);
    config = googleWriteField(config, "maxOutputTokens", 2048);
    config = googleWriteField(config, "topP", 0.9);
    config = googleWriteField(config, "thinkingBudget", 1024);
    config = googleWriteField(config, "thinkingLevel", "medium");
    config = googleWriteField(config, "includeThoughts", true);
    expect(googleReadField(config, "temperature")).toBe(0.5);
    expect(googleReadField(config, "maxOutputTokens")).toBe(2048);
    expect(googleReadField(config, "topP")).toBe(0.9);
    expect(googleReadField(config, "thinkingBudget")).toBe(1024);
    expect(googleReadField(config, "thinkingLevel")).toBe("medium");
    expect(googleReadField(config, "includeThoughts")).toBe(true);
  });

  it("rejects NaN numeric writes", () => {
    const config = googleWriteField({}, "topP", NaN);
    expect(googleReadField(config, "topP")).toBeUndefined();
    const tc = googleWriteField({}, "thinkingBudget", NaN);
    expect(googleReadField(tc, "thinkingBudget")).toBeUndefined();
  });

  it("compacts thinkingConfig when all sub-fields are cleared", () => {
    let config = googleWriteField({}, "thinkingBudget", 1024);
    config = googleWriteField(config, "thinkingLevel", "high");
    expect(googleReadField(config, "thinkingBudget")).toBe(1024);
    config = googleWriteField(config, "thinkingBudget", undefined);
    config = googleWriteField(config, "thinkingLevel", undefined);
    // thinkingConfig itself should have been dropped from the canonical config
    expect(googleReadField(config, "thinkingBudget")).toBeUndefined();
    expect(googleReadField(config, "thinkingLevel")).toBeUndefined();
  });
});
