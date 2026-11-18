import { describe, expect, it } from "vitest";

import type { OpenAIFormData, ProviderFormData } from "../CustomProviderForm";
import {
  buildClientConfig,
  buildProviderModels,
  createDefaultFormData,
  parseModelNames,
  type ProviderNode,
  transformConfigToFormValues,
  transformToPatchInput,
} from "../customProviderFormUtils";

type CustomProviderNode = Extract<
  ProviderNode,
  { __typename: "GenerativeModelCustomProvider" }
>;

function requireFormSdk<SDK extends ProviderFormData["sdk"]>({
  values,
  sdk,
}: {
  values: ProviderFormData;
  sdk: SDK;
}): Extract<ProviderFormData, { sdk: SDK }> {
  if (values.sdk !== sdk) {
    throw new Error(`expected ${sdk}, got ${values.sdk}`);
  }
  // TypeScript can't narrow a union by comparing its discriminant to a generic.
  return values as Extract<ProviderFormData, { sdk: SDK }>;
}

function openai(overrides: Partial<OpenAIFormData> = {}): OpenAIFormData {
  return {
    ...requireFormSdk({
      values: createDefaultFormData("OPENAI"),
      sdk: "OPENAI",
    }),
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
    const typesafe = {
      ...requireFormSdk({
        values: createDefaultFormData("TYPESAFE"),
        sdk: "TYPESAFE",
      }),
      name: "ts",
      typesafe_api_key: "ts-key",
      decision_enabled: false,
      decision_model_names: "jev-latest",
    };
    expect(buildProviderModels(typesafe)).toEqual({
      decision: { names: ["jev-latest"] },
    });
  });

  it("serves Gemini decision models alongside chat on Google GenAI when on", () => {
    const google = (
      overrides: Partial<
        Extract<ProviderFormData, { sdk: "GOOGLE_GENAI" }>
      > = {}
    ): Extract<ProviderFormData, { sdk: "GOOGLE_GENAI" }> => ({
      ...requireFormSdk({
        values: createDefaultFormData("GOOGLE_GENAI"),
        sdk: "GOOGLE_GENAI",
      }),
      name: "gemini",
      google_api_key: "g-key",
      ...overrides,
    });
    expect(buildProviderModels(google())).toEqual({ chat: { names: [] } });
    expect(
      buildProviderModels(
        google({
          decision_enabled: true,
          decision_model_names: "gemini-decision-1",
        })
      )
    ).toEqual({
      chat: { names: [] },
      decision: { names: ["gemini-decision-1"] },
    });
  });

  it("serves chat models on Azure OpenAI, and decision models when on", () => {
    const azure = {
      ...requireFormSdk({
        values: createDefaultFormData("AZURE_OPENAI"),
        sdk: "AZURE_OPENAI",
      }),
      name: "azure",
      azure_endpoint: "https://res.openai.azure.com",
      azure_api_key: "az-key",
      model_names: "gpt-6",
    };
    expect(buildProviderModels(azure)).toEqual({
      chat: { names: ["gpt-6"] },
    });
    expect(
      buildProviderModels({
        ...azure,
        decision_enabled: true,
        decision_model_names: "gpt-6-luna",
      })
    ).toEqual({
      chat: { names: ["gpt-6"] },
      decision: { names: ["gpt-6-luna"] },
    });
  });

  it("sends the suggested chat model names, which replace the built-in list", () => {
    expect(
      buildProviderModels(openai({ model_names: "qwen3-coder, llama-5-70b" }))
        .chat
    ).toEqual({ names: ["qwen3-coder", "llama-5-70b"] });
    expect(
      buildProviderModels({
        ...requireFormSdk({
          values: createDefaultFormData("AWS_BEDROCK"),
          sdk: "AWS_BEDROCK",
        }),
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
    for (const sdk of ["OPENAI", "AZURE_OPENAI", "GOOGLE_GENAI"] as const) {
      expect(createDefaultFormData(sdk)).toMatchObject({
        decision_enabled: false,
      });
    }
    expect(createDefaultFormData("TYPESAFE")).toMatchObject({
      decision_enabled: true,
    });
    for (const sdk of ["ANTHROPIC", "AWS_BEDROCK"] as const) {
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

function savedOpenAIProvider(
  decisionModelNames: readonly string[] | null
): CustomProviderNode {
  return {
    __typename: "GenerativeModelCustomProvider",
    id: "provider-id",
    name: "proxy",
    description: null,
    sdk: "OPENAI",
    provider: "openai",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    user: null,
    models: {
      chat: { names: [] },
      decision:
        decisionModelNames === null ? null : { names: decisionModelNames },
    },
    config: {
      openaiApiType: "RESPONSES",
      openaiAuthenticationMethod: { apiKey: "sk-old" },
      openaiClientKwargs: {
        baseUrl: "https://proxy.example/v1",
        organization: null,
        project: null,
        defaultHeaders: null,
      },
    },
  };
}

function saveUnrelatedEdit(node: CustomProviderNode) {
  const original = requireFormSdk({
    values: transformConfigToFormValues(node),
    sdk: "OPENAI",
  });
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
  it.each([
    {
      config: { parseError: "Cannot decrypt" },
      expected: "default_credentials",
    },
    {
      config: {
        awsBedrockAuthenticationMethod: {
          accessKeys: null,
          defaultCredentials: true,
        },
      },
      expected: "default_credentials",
    },
    {
      config: {
        awsBedrockAuthenticationMethod: {
          accessKeys: {
            awsAccessKeyId: "access-key",
            awsSecretAccessKey: "secret-key",
            awsSessionToken: null,
          },
          defaultCredentials: null,
        },
      },
      expected: "access_keys",
    },
  ])("uses $expected for AWS authentication", ({ config, expected }) => {
    const provider: CustomProviderNode = {
      ...savedOpenAIProvider(null),
      sdk: "AWS_BEDROCK",
      config,
    };
    const values = requireFormSdk({
      values: transformConfigToFormValues(provider),
      sdk: "AWS_BEDROCK",
    });
    expect(values.aws_auth_method).toBe(expected);
    if (expected === "access_keys") {
      expect(values.aws_access_key_id).toBe("access-key");
      expect(values.aws_secret_access_key).toBe("secret-key");
    }
  });

  it("load Azure decision models into the form", () => {
    const provider: CustomProviderNode = {
      ...savedOpenAIProvider(["gpt-6-luna"]),
      sdk: "AZURE_OPENAI",
      config: {
        openaiApiType: "RESPONSES",
        azureOpenaiAuthenticationMethod: {
          apiKey: "az-key",
          azureAdTokenProvider: null,
          defaultCredentials: null,
        },
        azureOpenaiClientKwargs: {
          azureEndpoint: "https://res.openai.azure.com",
          defaultHeaders: null,
        },
      },
    };
    const values = requireFormSdk({
      values: transformConfigToFormValues(provider),
      sdk: "AZURE_OPENAI",
    });
    expect(values.decision_enabled).toBe(true);
    expect(values.decision_model_names).toBe("gpt-6-luna");
    expect(values.azure_endpoint).toBe("https://res.openai.azure.com");
    expect(values.azure_api_key).toBe("az-key");
  });

  it("load into the form", () => {
    const values = requireFormSdk({
      values: transformConfigToFormValues(savedOpenAIProvider(["gpt-6-luna"])),
      sdk: "OPENAI",
    });
    expect(values.decision_enabled).toBe(true);
    expect(values.decision_model_names).toBe("gpt-6-luna");
    const withoutDecisions = requireFormSdk({
      values: transformConfigToFormValues(savedOpenAIProvider(null)),
      sdk: "OPENAI",
    });
    expect(withoutDecisions.decision_enabled).toBe(false);
  });

  it("are not resent when only the connection changes", () => {
    const { patch } = saveUnrelatedEdit(savedOpenAIProvider(["gpt-6-luna"]));
    expect(patch.clientConfig?.openai?.openaiAuthenticationMethod).toEqual({
      apiKey: "sk-new",
    });
    expect(patch.models).toBeUndefined();
  });

  it("remain intact when the encrypted connection config cannot be parsed", () => {
    const unparsable: CustomProviderNode = {
      ...savedOpenAIProvider(["gpt-6-luna"]),
      models: {
        chat: { names: ["gpt-4o-custom"] },
        decision: { names: ["gpt-6-luna"] },
      },
      config: {
        parseError: "Config cannot be decrypted",
      },
    };
    const values = requireFormSdk({
      values: transformConfigToFormValues(unparsable),
      sdk: "OPENAI",
    });
    expect(values.openai_api_key).toBe("");
    expect(values.model_names).toBe("gpt-4o-custom");
    expect(values.decision_enabled).toBe(true);
    expect(values.decision_model_names).toBe("gpt-6-luna");

    const { patch } = saveUnrelatedEdit(unparsable);
    expect(patch.clientConfig?.openai?.openaiAuthenticationMethod).toEqual({
      apiKey: "sk-new",
    });
    expect(patch.models).toBeUndefined();
  });
});
