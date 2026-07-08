import type { PromptInvocationParametersReadableFragment$data } from "../../__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  openAIConfigFromPromptInvocationParameters,
  openAIConfigFromSpanInvocationParameters,
  openAIConfigToPromptInput,
  openAIReadField,
  openAIWriteField,
  parseOpenAIConfig,
} from "../openaiAdapter";

describe("parseOpenAIConfig", () => {
  it("drops unknown keys and preserves canonical fields", () => {
    expect(
      parseOpenAIConfig({
        temperature: 0.5,
        topP: 0.9,
        maxCompletionTokens: 1024,
        frequencyPenalty: 0.2,
        presencePenalty: 0.3,
        reasoningEffort: "high",
        seed: 42,
        stop: ["END"],
        extraBody: { foo: 1 },
        garbage: "drop",
      })
    ).toEqual({
      temperature: 0.5,
      topP: 0.9,
      maxCompletionTokens: 1024,
      frequencyPenalty: 0.2,
      presencePenalty: 0.3,
      reasoningEffort: "high",
      seed: 42,
      stop: ["END"],
      extraBody: { foo: 1 },
    });
  });

  it("accepts GraphQL-cased reasoningEffort and stores the form value", () => {
    expect(parseOpenAIConfig({ reasoningEffort: "HIGH" })).toEqual({
      reasoningEffort: "high",
    });
  });
});

describe("openAIConfigToPromptInput", () => {
  it("drops zero-valued frequency/presence penalties at serialization", () => {
    const input = openAIConfigToPromptInput({
      temperature: 0.5,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });
    expect(input.openai?.temperature).toBe(0.5);
    expect(input.openai).not.toHaveProperty("frequencyPenalty");
    expect(input.openai).not.toHaveProperty("presencePenalty");
  });

  it("uppercases reasoningEffort back to the GraphQL enum", () => {
    expect(
      openAIConfigToPromptInput({ reasoningEffort: "high" }).openai
        ?.reasoningEffort
    ).toBe("HIGH");
  });
});

describe("openAIConfigFromPromptInvocationParameters", () => {
  it("reads the OpenAI branch and folds openaiMaxTokens into maxCompletionTokens", () => {
    const data: PromptInvocationParametersReadableFragment$data = {
      __typename: "PromptOpenAIInvocationParameters",
      temperature: 0.5,
      topP: null,
      maxCompletionTokens: null,
      openaiMaxTokens: 2048,
      frequencyPenalty: null,
      presencePenalty: null,
      seed: null,
      stop: null,
      reasoningEffort: "LOW",
      extraBody: null,
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(openAIConfigFromPromptInvocationParameters(data)).toEqual({
      temperature: 0.5,
      maxCompletionTokens: 2048,
      reasoningEffort: "low",
    });
  });
});

describe("openAIConfigFromSpanInvocationParameters", () => {
  it("folds max_output_tokens into maxCompletionTokens for Responses spans", () => {
    const { config } = openAIConfigFromSpanInvocationParameters(
      { max_output_tokens: 2048, reasoning: { effort: "high" } },
      "RESPONSES"
    );
    expect(config).toEqual({
      maxCompletionTokens: 2048,
      reasoningEffort: "high",
    });
  });

  it("promotes Chat Completions response_format to canonical responseFormat", () => {
    const { promoted } = openAIConfigFromSpanInvocationParameters(
      {
        response_format: {
          type: "json_schema",
          json_schema: { name: "x", schema: { type: "object" } },
        },
      },
      "CHAT_COMPLETIONS"
    );
    expect(promoted.responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: { name: "x", schema: { type: "object" } },
    });
  });
});

describe("openAI field-keyed read/write", () => {
  it("round-trips numeric, enum, and string-list leaves", () => {
    let config = openAIWriteField({}, "temperature", 0.5);
    config = openAIWriteField(config, "maxCompletionTokens", 1024);
    config = openAIWriteField(config, "reasoningEffort", "high");
    config = openAIWriteField(config, "stop", ["END"]);
    config = openAIWriteField(config, "extraBody", { foo: 1 });
    expect(openAIReadField(config, "temperature")).toBe(0.5);
    expect(openAIReadField(config, "maxCompletionTokens")).toBe(1024);
    expect(openAIReadField(config, "reasoningEffort")).toBe("high");
    expect(openAIReadField(config, "stop")).toEqual(["END"]);
    expect(openAIReadField(config, "extraBody")).toEqual({ foo: 1 });
  });

  it("rejects NaN numeric writes", () => {
    const config = openAIWriteField({}, "temperature", NaN);
    expect(openAIReadField(config, "temperature")).toBeUndefined();
  });

  it("clears reasoningEffort with undefined", () => {
    const set = openAIWriteField({}, "reasoningEffort", "high");
    const cleared = openAIWriteField(set, "reasoningEffort", undefined);
    expect(openAIReadField(cleared, "reasoningEffort")).toBeUndefined();
  });

  it("clears extraBody with undefined", () => {
    const set = openAIWriteField({}, "extraBody", { foo: 1 });
    const cleared = openAIWriteField(set, "extraBody", undefined);
    expect(openAIReadField(cleared, "extraBody")).toBeUndefined();
  });
});
