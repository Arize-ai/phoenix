import { describe, expect, it } from "vitest";

import type {
  AWSBedrockFormData,
  OpenAIFormData,
  TypeSafeFormData,
} from "../CustomProviderForm";
import {
  buildClientConfig,
  createDefaultFormData,
  parseModelNames,
  transformToPatchInput,
} from "../customProviderFormUtils";

function openai(overrides: Partial<OpenAIFormData> = {}): OpenAIFormData {
  return {
    ...(createDefaultFormData("OPENAI") as OpenAIFormData),
    name: "proxy",
    openai_api_key: "sk-test",
    ...overrides,
  };
}

describe("decision models in the client config", () => {
  it("sends none while decision models are off", () => {
    const config = buildClientConfig(openai());
    expect(config.openai?.decisionModels).toBeUndefined();
  });

  it("sends the client, base URL, and suggested names when on", () => {
    const config = buildClientConfig(
      openai({
        decision_enabled: true,
        decision_sdk: "TYPESAFE",
        decision_base_url: " https://api.typesafe.ai ",
        decision_model_names: "jev-latest, jev-1.14.0",
      })
    );
    expect(config.openai?.decisionModels).toEqual({
      decisionSdk: "TYPESAFE",
      baseUrl: "https://api.typesafe.ai",
      modelNames: ["jev-latest", "jev-1.14.0"],
    });
  });

  it("always runs a TypeSafe provider through System One at its own base URL", () => {
    const typesafe: TypeSafeFormData = {
      ...(createDefaultFormData("TYPESAFE") as TypeSafeFormData),
      name: "ts",
      typesafe_api_key: "ts-key",
      typesafe_base_url: "https://system-one.example",
      decision_enabled: false,
      decision_sdk: "OPENAI",
      decision_base_url: "https://ignored.example",
      decision_model_names: "jev-latest",
    };
    expect(buildClientConfig(typesafe).typesafe?.decisionModels).toEqual({
      decisionSdk: "TYPESAFE",
      modelNames: ["jev-latest"],
    });
  });

  it("defaults decision models off, except for TypeSafe", () => {
    expect(createDefaultFormData("OPENAI")).toMatchObject({
      decision_enabled: false,
    });
    expect(createDefaultFormData("AZURE_OPENAI")).toMatchObject({
      decision_enabled: false,
    });
    expect(createDefaultFormData("TYPESAFE")).toMatchObject({
      decision_enabled: true,
      decision_sdk: "TYPESAFE",
    });
    expect(createDefaultFormData("ANTHROPIC")).not.toHaveProperty(
      "decision_enabled"
    );
  });

  it("patches the config when only the decision settings change", () => {
    const original = openai();
    const patch = transformToPatchInput(
      openai({ decision_enabled: true, decision_sdk: "OPENAI" }),
      "provider-id",
      original
    );
    expect(patch.clientConfig?.openai?.decisionModels).toEqual({
      decisionSdk: "OPENAI",
    });
    expect(
      transformToPatchInput(original, "provider-id", original).clientConfig
    ).toBeUndefined();
  });
});

describe("suggested LLM model names in the client config", () => {
  it("sends the names, which replace the SDK's built-in list", () => {
    expect(
      buildClientConfig(openai({ model_names: "qwen3-coder, llama-5-70b" }))
        .openai?.modelNames
    ).toEqual(["qwen3-coder", "llama-5-70b"]);
    expect(
      buildClientConfig({
        ...(createDefaultFormData("AWS_BEDROCK") as AWSBedrockFormData),
        name: "bedrock",
        aws_region: "us-east-1",
        model_names: "us.anthropic.claude-gateway",
      }).awsBedrock?.modelNames
    ).toEqual(["us.anthropic.claude-gateway"]);
  });

  it("sends none when the field is empty, so the built-in list is used", () => {
    expect(buildClientConfig(openai()).openai).not.toHaveProperty("modelNames");
    expect(
      buildClientConfig(openai({ model_names: " , " })).openai
    ).not.toHaveProperty("modelNames");
  });

  it("patches the config when only the names change", () => {
    const original = openai();
    const patch = transformToPatchInput(
      openai({ model_names: "qwen3-coder" }),
      "provider-id",
      original
    );
    expect(patch.clientConfig?.openai?.modelNames).toEqual(["qwen3-coder"]);
  });
});

describe("parseModelNames", () => {
  it("splits on commas and newlines, drops blanks and repeats", () => {
    expect(parseModelNames(" jev-latest,\njev-1.14.0 , ,jev-latest")).toEqual([
      "jev-latest",
      "jev-1.14.0",
    ]);
    expect(parseModelNames(undefined)).toEqual([]);
  });
});
