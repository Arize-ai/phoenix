import { describe, expect, it } from "vitest";

import type {
  AWSBedrockFormData,
  OpenAIFormData,
  TypeSafeFormData,
} from "../CustomProviderForm";
import { providerFormSchema } from "../customProviderFormSchema";
import {
  buildClientConfig,
  createDefaultFormData,
  parseModelNames,
  type ProviderNode,
  transformConfigToFormValues,
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
        decision_base_url: " https://system-one.example ",
        decision_model_names: "jev-latest, jev-1.14.0",
      })
    );
    expect(config.openai?.decisionModels).toEqual({
      decisionSdk: "TYPESAFE",
      baseUrl: "https://system-one.example",
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

describe("the decision base URL", () => {
  it("doesn't store the pre-filled guess, so runs follow the chat base URL", () => {
    const config = buildClientConfig(
      openai({
        openai_base_url: "https://proxy.example/v1/",
        decision_enabled: true,
        decision_sdk: "OPENAI",
        decision_base_url: "https://proxy.example/v1",
      })
    );
    expect(config.openai?.decisionModels).toEqual({ decisionSdk: "OPENAI" });
  });

  it("stores a base URL the user changed", () => {
    const config = buildClientConfig(
      openai({
        openai_base_url: "https://proxy.example/v1",
        decision_enabled: true,
        decision_sdk: "OPENAI",
        decision_base_url: "https://decisions.example/v1",
      })
    );
    expect(config.openai?.decisionModels).toEqual({
      decisionSdk: "OPENAI",
      baseUrl: "https://decisions.example/v1",
    });
  });

  it("stays unset when a provider saved without one is edited and saved", () => {
    const node = {
      __typename: "GenerativeModelCustomProvider",
      id: "provider-id",
      name: "proxy",
      description: null,
      sdk: "OPENAI",
      provider: "openai",
      config: {
        __typename: "OpenAICustomProviderConfig",
        openaiApiType: "RESPONSES",
        modelNames: [],
        decisionModels: {
          decisionSdk: "OPENAI",
          baseUrl: null,
          modelNames: [],
        },
        openaiAuthenticationMethod: { apiKey: "sk-old" },
        openaiClientKwargs: {
          baseUrl: "https://proxy.example/v1",
          organization: null,
          project: null,
          defaultHeaders: null,
        },
      },
    } as unknown as ProviderNode;
    const original = transformConfigToFormValues(node);
    expect(original).toMatchObject({
      decision_base_url: "https://proxy.example/v1",
    });
    const patch = transformToPatchInput(
      { ...original, openai_api_key: "sk-new" } as OpenAIFormData,
      "provider-id",
      original
    );
    expect(patch.clientConfig?.openai?.decisionModels).toEqual({
      decisionSdk: "OPENAI",
    });
  });
});

describe("decision base URL validation", () => {
  it("ignores an invalid base URL while decision models are off", () => {
    const result = providerFormSchema.safeParse(
      openai({ decision_enabled: false, decision_base_url: "foo" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an invalid base URL while decision models are on", () => {
    const result = providerFormSchema.safeParse(
      openai({ decision_enabled: true, decision_base_url: "foo" })
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["decision_base_url"]);
  });
});
