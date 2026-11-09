import { describe, expect, it } from "vitest";

import type {
  AWSBedrockFormData,
  AzureOpenAIFormData,
  OpenAIFormData,
  TypeSafeFormData,
} from "../CustomProviderForm";
import {
  buildClientConfig,
  buildProviderModels,
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

describe("provider models", () => {
  it("serves chat models only while decision models are off", () => {
    expect(buildProviderModels(openai())).toEqual({
      chat: { names: [] },
    });
  });

  it("serves decision models, with their suggested names, when on", () => {
    expect(
      buildProviderModels(
        openai({
          decision_enabled: true,
          decision_model_names: "gpt-6-luna, gpt-6-luna-mini",
        })
      )
    ).toEqual({
      chat: { names: [] },
      decision: { names: ["gpt-6-luna", "gpt-6-luna-mini"] },
    });
  });

  it("always serves decision models, and only them, on TypeSafe", () => {
    const typesafe: TypeSafeFormData = {
      ...(createDefaultFormData("TYPESAFE") as TypeSafeFormData),
      name: "ts",
      typesafe_api_key: "ts-key",
      decision_enabled: false,
      decision_model_names: "jev-latest",
    };
    expect(buildProviderModels(typesafe)).toEqual({
      decision: { names: ["jev-latest"] },
    });
  });

  it("serves chat models only on Azure OpenAI", () => {
    const azure: AzureOpenAIFormData = {
      ...(createDefaultFormData("AZURE_OPENAI") as AzureOpenAIFormData),
      name: "azure",
      azure_endpoint: "https://res.openai.azure.com",
      azure_api_key: "az-key",
      model_names: "gpt-6",
    };
    expect(buildProviderModels(azure)).toEqual({
      chat: { names: ["gpt-6"] },
    });
  });

  it("sends the suggested chat model names, which replace the built-in list", () => {
    expect(
      buildProviderModels(openai({ model_names: "qwen3-coder, llama-5-70b" }))
        .chat
    ).toEqual({ names: ["qwen3-coder", "llama-5-70b"] });
    expect(
      buildProviderModels({
        ...(createDefaultFormData("AWS_BEDROCK") as AWSBedrockFormData),
        name: "bedrock",
        aws_region: "us-east-1",
        model_names: "us.anthropic.claude-gateway",
      })
    ).toEqual({
      chat: { names: ["us.anthropic.claude-gateway"] },
    });
    expect(buildProviderModels(openai({ model_names: " , " })).chat).toEqual({
      names: [],
    });
  });

  it("stays out of the connection", () => {
    const config = buildClientConfig(
      openai({ decision_enabled: true, model_names: "qwen3-coder" })
    );
    expect(Object.keys(config.openai ?? {}).sort()).toEqual([
      "openaiApiType",
      "openaiAuthenticationMethod",
      "openaiClientKwargs",
    ]);
  });

  it("defaults decision models off, except for TypeSafe", () => {
    expect(createDefaultFormData("OPENAI")).toMatchObject({
      decision_enabled: false,
    });
    expect(createDefaultFormData("TYPESAFE")).toMatchObject({
      decision_enabled: true,
    });
    for (const sdk of ["AZURE_OPENAI", "ANTHROPIC"] as const) {
      expect(createDefaultFormData(sdk)).not.toHaveProperty("decision_enabled");
    }
  });

  it("patches only the models when only they change", () => {
    const original = openai();
    const patch = transformToPatchInput(
      openai({ decision_enabled: true, model_names: "qwen3-coder" }),
      "provider-id",
      original
    );
    expect(patch.clientConfig).toBeUndefined();
    expect(patch.models).toEqual({
      chat: { names: ["qwen3-coder"] },
      decision: { names: [] },
    });
    const unchanged = transformToPatchInput(original, "provider-id", original);
    expect(unchanged.clientConfig).toBeUndefined();
    expect(unchanged.models).toBeUndefined();
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

function savedOpenAIProvider(decisionModelNames: string[] | null) {
  return {
    __typename: "GenerativeModelCustomProvider",
    id: "provider-id",
    name: "proxy",
    description: null,
    sdk: "OPENAI",
    provider: "openai",
    models: {
      chat: { names: [] },
      decision:
        decisionModelNames === null ? null : { names: decisionModelNames },
    },
    config: {
      __typename: "OpenAICustomProviderConfig",
      openaiApiType: "RESPONSES",
      openaiAuthenticationMethod: { apiKey: "sk-old" },
      openaiClientKwargs: {
        baseUrl: "https://proxy.example/v1",
        organization: null,
        project: null,
        defaultHeaders: null,
      },
    },
  } as unknown as ProviderNode;
}

function saveUnrelatedEdit(node: ProviderNode) {
  const original = transformConfigToFormValues(node) as OpenAIFormData;
  return {
    original,
    patch: transformToPatchInput(
      { ...original, openai_api_key: "sk-new" },
      "provider-id",
      original
    ),
  };
}

describe("a saved provider's models", () => {
  it("load into the form", () => {
    const values = transformConfigToFormValues(
      savedOpenAIProvider(["gpt-6-luna"])
    ) as OpenAIFormData;
    expect(values.decision_enabled).toBe(true);
    expect(values.decision_model_names).toBe("gpt-6-luna");
    expect(
      (transformConfigToFormValues(savedOpenAIProvider(null)) as OpenAIFormData)
        .decision_enabled
    ).toBe(false);
  });

  it("are not resent when only the connection changes", () => {
    const { patch } = saveUnrelatedEdit(savedOpenAIProvider(["gpt-6-luna"]));
    expect(patch.clientConfig?.openai?.openaiAuthenticationMethod).toEqual({
      apiKey: "sk-new",
    });
    expect(patch.models).toBeUndefined();
  });
});
