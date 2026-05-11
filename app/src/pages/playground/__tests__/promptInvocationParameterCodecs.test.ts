import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  readPromptInvocationParametersUnion,
  writePromptInvocationParametersMutationInput,
} from "../promptInvocationParameterCodecs";

type ReadInput = PromptInvocationParametersReadableFragment$data;

describe("prompt invocation parameter codecs", () => {
  it("reads OpenAI prompt invocation parameters into the camelCase record", () => {
    const input: ReadInput = {
      __typename: "PromptOpenAIInvocationParameters",
      temperature: 0.4,
      openaiMaxTokens: 64,
      maxCompletionTokens: 128,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
      topP: 0.9,
      seed: 7,
      stop: null,
      reasoningEffort: "LOW",
      extraBody: null,
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(readPromptInvocationParametersUnion(input)).toEqual({
      family: "openai",
      parameters: {
        temperature: 0.4,
        maxTokens: 64,
        maxCompletionTokens: 128,
        frequencyPenalty: 0.2,
        presencePenalty: 0.1,
        topP: 0.9,
        seed: 7,
        reasoningEffort: "low",
      },
    });
  });

  it("reads Anthropic thinking config preserving the discriminator", () => {
    const input: ReadInput = {
      __typename: "PromptAnthropicInvocationParameters",
      anthropicMaxTokens: 1024,
      temperature: 0.7,
      topP: 0.95,
      stopSequences: ["STOP"],
      outputConfig: null,
      extraBody: null,
      thinking: {
        __typename: "PromptAnthropicThinkingEnabled",
        budgetTokens: 256,
        enabledDisplay: null,
      },
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(readPromptInvocationParametersUnion(input)).toEqual({
      family: "anthropic",
      parameters: {
        maxTokens: 1024,
        temperature: 0.7,
        topP: 0.95,
        stopSequences: ["STOP"],
        thinking: {
          type: "enabled",
          budgetTokens: 256,
        },
      },
    });
  });

  it("throws for the Relay %other forward-compat sentinel", () => {
    const input: ReadInput = {
      __typename: "%other",
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(() => readPromptInvocationParametersUnion(input)).toThrow(
      "Unsupported prompt invocation parameters typename: %other"
    );
  });

  it("writes OpenAI-family records through the openai branch", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "openai",
      parameters: {
        temperature: 0.3,
        maxCompletionTokens: 222,
        topP: 0.8,
      },
    });
    expect(result).toEqual({
      openai: {
        temperature: 0.3,
        maxTokens: undefined,
        maxCompletionTokens: 222,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        topP: 0.8,
        seed: undefined,
        stop: undefined,
        reasoningEffort: undefined,
        extraBody: undefined,
      },
    });
  });

  it("uppercases OpenAI reasoning effort to the GraphQL enum value", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "openai",
      parameters: { reasoningEffort: "high" },
    });
    expect(result).toEqual({
      openai: {
        temperature: undefined,
        maxTokens: undefined,
        maxCompletionTokens: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        topP: undefined,
        seed: undefined,
        stop: undefined,
        reasoningEffort: "HIGH",
        extraBody: undefined,
      },
    });
  });

  it("omits invalid OpenAI reasoning effort values", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "openai",
      parameters: { reasoningEffort: "ultra" },
    });
    expect(result).toEqual({
      openai: {
        temperature: undefined,
        maxTokens: undefined,
        maxCompletionTokens: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
        topP: undefined,
        seed: undefined,
        stop: undefined,
        reasoningEffort: undefined,
        extraBody: undefined,
      },
    });
  });

  it("writes Anthropic thinking config to the @oneOf input", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "anthropic",
      parameters: {
        maxTokens: 2048,
        temperature: 0.5,
        thinking: { type: "disabled" },
      },
    });
    expect(result).toEqual({
      anthropic: {
        maxTokens: 2048,
        temperature: 0.5,
        topP: undefined,
        stopSequences: undefined,
        outputConfig: undefined,
        thinking: { disabled: { disabled: true } },
        extraBody: undefined,
      },
    });
  });

  it("throws for Anthropic writes without maxTokens", () => {
    expect(() =>
      writePromptInvocationParametersMutationInput({
        family: "anthropic",
        parameters: { temperature: 0.5 },
      })
    ).toThrow("Anthropic invocation parameters require maxTokens");
  });

  it("writes Google thinkingConfig with the GraphQL enum casing", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "google_genai",
      parameters: {
        maxOutputTokens: 512,
        thinkingConfig: {
          thinkingBudget: 100,
          thinkingLevel: "high",
          includeThoughts: true,
        },
      },
    });
    expect(result).toEqual({
      google: {
        temperature: undefined,
        maxOutputTokens: 512,
        stopSequences: undefined,
        presencePenalty: undefined,
        frequencyPenalty: undefined,
        topP: undefined,
        topK: undefined,
        thinkingConfig: {
          thinkingBudget: 100,
          thinkingLevel: "HIGH",
          includeThoughts: true,
        },
      },
    });
  });

  it("omits Google thinkingConfig when no inner fields are set", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "google_genai",
      parameters: { thinkingConfig: {} },
    });
    expect(
      (result as { google: { thinkingConfig?: unknown } }).google.thinkingConfig
    ).toBeUndefined();
  });

  it("writes AWS Bedrock stopSequences", () => {
    const result = writePromptInvocationParametersMutationInput({
      family: "aws_bedrock",
      parameters: {
        maxTokens: 512,
        temperature: 0.7,
        topP: 0.9,
        stopSequences: ["END"],
      },
    });
    expect(result).toEqual({
      aws: {
        maxTokens: 512,
        temperature: 0.7,
        topP: 0.9,
        stopSequences: ["END"],
      },
    });
  });
});
