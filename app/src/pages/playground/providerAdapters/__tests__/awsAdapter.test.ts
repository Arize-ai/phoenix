import type { PromptInvocationParametersReadableFragment$data } from "../../__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  awsConfigFromPromptInvocationParameters,
  awsConfigFromSpanInvocationParameters,
  awsConfigToPromptInput,
  awsReadField,
  awsWriteField,
  parseAwsConfig,
} from "../awsAdapter";

describe("parseAwsConfig", () => {
  it("drops unknown keys and preserves canonical fields", () => {
    expect(
      parseAwsConfig({
        maxTokens: 1024,
        temperature: 0.5,
        topP: 0.9,
        stopSequences: ["END"],
        garbage: 1,
      })
    ).toEqual({
      maxTokens: 1024,
      temperature: 0.5,
      topP: 0.9,
      stopSequences: ["END"],
    });
  });
});

describe("awsConfigToPromptInput", () => {
  it("emits a minimal AWS branch and omits undefined keys", () => {
    expect(awsConfigToPromptInput({})).toEqual({ aws: {} });
    expect(awsConfigToPromptInput({ maxTokens: 1024 })).toEqual({
      aws: { maxTokens: 1024 },
    });
  });
});

describe("awsConfigFromPromptInvocationParameters", () => {
  it("reads the AWS branch and maps awsMaxTokens to maxTokens", () => {
    const data: PromptInvocationParametersReadableFragment$data = {
      __typename: "PromptAwsInvocationParameters",
      awsMaxTokens: 2048,
      temperature: 0.5,
      topP: 0.9,
      stopSequences: ["END"],
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(awsConfigFromPromptInvocationParameters(data)).toEqual({
      maxTokens: 2048,
      temperature: 0.5,
      topP: 0.9,
      stopSequences: ["END"],
    });
  });
});

describe("awsConfigFromSpanInvocationParameters", () => {
  it("lifts inferenceConfig.* into flat top-level fields", () => {
    const { config } = awsConfigFromSpanInvocationParameters({
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.5,
        topP: 0.9,
        stopSequences: ["END"],
      },
    });
    expect(config).toEqual({
      maxTokens: 1024,
      temperature: 0.5,
      topP: 0.9,
      stopSequences: ["END"],
    });
  });

  it("prefers top-level over inferenceConfig when both present", () => {
    const { config } = awsConfigFromSpanInvocationParameters({
      maxTokens: 999,
      inferenceConfig: { maxTokens: 1024 },
    });
    expect(config.maxTokens).toBe(999);
  });

  it("decodes a JSON-string schema in outputConfig and promotes to responseFormat", () => {
    const schema = { type: "object", properties: {} };
    const { promoted } = awsConfigFromSpanInvocationParameters({
      inferenceConfig: { maxTokens: 1024 },
      outputConfig: {
        textFormat: {
          structure: {
            jsonSchema: { name: "test", schema: JSON.stringify(schema) },
          },
        },
      },
    });
    expect(promoted.responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: { name: "test", schema },
    });
  });
});

describe("aws field-keyed read/write", () => {
  it("round-trips each scalar leaf", () => {
    let config = awsWriteField({}, "maxTokens", 1024);
    config = awsWriteField(config, "temperature", 0.5);
    config = awsWriteField(config, "topP", 0.9);
    config = awsWriteField(config, "stopSequences", ["END"]);
    expect(awsReadField(config, "maxTokens")).toBe(1024);
    expect(awsReadField(config, "temperature")).toBe(0.5);
    expect(awsReadField(config, "topP")).toBe(0.9);
    expect(awsReadField(config, "stopSequences")).toEqual(["END"]);
  });

  it("clears a leaf with undefined", () => {
    const set = awsWriteField({}, "temperature", 0.5);
    expect(awsReadField(set, "temperature")).toBe(0.5);
    const cleared = awsWriteField(set, "temperature", undefined);
    expect(awsReadField(cleared, "temperature")).toBeUndefined();
  });

  it("rejects NaN numeric writes", () => {
    const config = awsWriteField({}, "temperature", NaN);
    expect(awsReadField(config, "temperature")).toBeUndefined();
  });

  it("ignores unknown field names", () => {
    expect(awsReadField({}, "garbage")).toBeUndefined();
    expect(awsWriteField({}, "garbage", "x")).toEqual({});
  });
});
