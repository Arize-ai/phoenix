import { objectToInvocationParameters } from "../invocationParameterUtils";

describe("objectToInvocationParameters", () => {
  it("normalizes legacy OpenAI maxTokens to maxCompletionTokens", () => {
    expect(
      objectToInvocationParameters({
        family: "openai",
        parameters: { maxTokens: 512 },
      })
    ).toEqual([
      {
        invocationName: "maxCompletionTokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 512,
      },
    ]);
  });

  it("prefers canonical maxCompletionTokens over legacy maxTokens", () => {
    expect(
      objectToInvocationParameters({
        family: "openai",
        parameters: { maxTokens: 128, maxCompletionTokens: 256 },
      })
    ).toEqual([
      {
        invocationName: "maxCompletionTokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 256,
      },
    ]);
  });

  it("does not rewrite maxTokens for Anthropic", () => {
    expect(
      objectToInvocationParameters({
        family: "anthropic",
        parameters: { maxTokens: 1024 },
      })
    ).toEqual([
      {
        invocationName: "maxTokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 1024,
      },
    ]);
  });
});
