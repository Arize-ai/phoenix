import { promptInvocationDataToDisplayRecord } from "..";
import type { PromptInvocationParametersReadableFragment$data } from "../../__generated__/PromptInvocationParametersReadableFragment.graphql";

type ReadInput = PromptInvocationParametersReadableFragment$data;

describe("provider adapter prompt display projection", () => {
  it("reads OpenAI prompt invocation parameters through the OpenAI adapter", () => {
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
    expect(promptInvocationDataToDisplayRecord(input)).toEqual({
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

  it("reads Anthropic thinking config through the Anthropic adapter", () => {
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
    expect(promptInvocationDataToDisplayRecord(input)).toEqual({
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
    expect(() => promptInvocationDataToDisplayRecord(input)).toThrow(
      "Unsupported prompt invocation parameters typename: %other"
    );
  });
});
