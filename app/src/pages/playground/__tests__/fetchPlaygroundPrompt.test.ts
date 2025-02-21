import {
  invocationParametersToObject,
  objectToInvocationParameters,
} from "../fetchPlaygroundPrompt";

type InvocationParameterInput = Parameters<
  typeof invocationParametersToObject
>[0];
type SupportedParamsType = Parameters<typeof objectToInvocationParameters>[1];

describe("objectToInvocationParameters", () => {
  it("should convert simple parameters with matching definitions", () => {
    const params = {
      temperature: 0.7,
      max_tokens: 100,
    };

    const supportedParams = [
      {
        __typename: "FloatInvocationParameter",
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        invocationInputField: "value_float",
      },
      {
        __typename: "IntInvocationParameter",
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        invocationInputField: "value_int",
      },
    ] satisfies SupportedParamsType;

    const result = objectToInvocationParameters(params, supportedParams);

    expect(result).toEqual([
      {
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        valueFloat: 0.7,
      },
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 100,
      },
    ]);
  });

  it("should handle parameters without matching definitions", () => {
    const params = {
      unknownParam: "test",
      maxTokens: 100,
    };

    const supportedParams = [] satisfies SupportedParamsType;

    const result = objectToInvocationParameters(params, supportedParams);

    expect(result).toEqual([
      {
        invocationName: "unknownParam",
        valueJson: "test",
      },
      {
        invocationName: "maxTokens",
        valueJson: 100,
      },
    ]);
  });
});

describe("invocationParametersToObject", () => {
  it("should convert invocation parameters back to object format", () => {
    const params = [
      {
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        valueFloat: 0.7,
      },
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 100,
      },
    ] satisfies InvocationParameterInput;

    const supportedParams = [
      {
        __typename: "FloatInvocationParameter",
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        invocationInputField: "value_float",
      },
      {
        __typename: "IntInvocationParameter",
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        invocationInputField: "value_int",
      },
    ] satisfies SupportedParamsType;

    const result = invocationParametersToObject(params, supportedParams);

    expect(result).toEqual({
      temperature: 0.7,
      max_tokens: 100,
    });
  });

  it("should handle empty parameters", () => {
    const result = invocationParametersToObject([], []);
    expect(result).toEqual({});
  });
});
