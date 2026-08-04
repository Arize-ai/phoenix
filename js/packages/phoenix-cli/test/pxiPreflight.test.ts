import { describe, expect, it, vi } from "vitest";

import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import {
  getRecommendedPxiModels,
  isSameModelSelection,
  resolveRestoredPxiModelSelection,
  runPxiModelPreflight,
} from "../src/pxi/preflight";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function createRuntimeOptions(
  cliOptions: Parameters<typeof resolvePxiRuntimeOptions>[0]["cliOptions"] = {}
) {
  return resolvePxiRuntimeOptions({
    cliOptions: {
      endpoint: "http://localhost:6006",
      provider: "OPENAI",
      model: "gpt-5.4",
      ...cliOptions,
    },
    sessionId: "session-1",
  });
}

function createPreflightData({
  provider = {
    key: "OPENAI",
    name: "OpenAI",
    dependenciesInstalled: true,
    credentialsSet: true,
    credentialRequirements: [
      {
        envVarName: "OPENAI_API_KEY",
        isRequired: true,
      },
    ],
  },
  playgroundModels = [
    {
      providerKey: "OPENAI",
      name: "gpt-5.4",
    },
  ],
  customProviders = [],
}: {
  provider?: {
    key: string;
    name: string;
    dependenciesInstalled: boolean;
    credentialsSet: boolean;
    credentialRequirements: Array<{
      envVarName: string;
      isRequired: boolean;
    }>;
  };
  playgroundModels?: Array<{
    providerKey: string;
    name: string;
  }>;
  customProviders?: Array<{
    id: string;
    name: string;
    sdk: string;
    modelNames: string[];
  }>;
} = {}) {
  return {
    modelProviders: [provider],
    playgroundModels,
    generativeModelCustomProviders: {
      edges: customProviders.map((node) => ({ node })),
    },
  };
}

function createFetch({
  body,
  status = 200,
  statusText = "OK",
}: {
  body: unknown;
  status?: number;
  statusText?: string;
}) {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      init,
    });
    return new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };
  return { fetchImpl, calls };
}

describe("isSameModelSelection", () => {
  // The session poll uses this to decide whether the model actually moved.
  // A false negative would put a catalog round trip on every poll tick.
  it("treats an omitted openaiApiType as the default", () => {
    expect(
      isSameModelSelection(
        { providerType: "builtin", provider: "OPENAI", modelName: "gpt-5.4" },
        {
          providerType: "builtin",
          provider: "OPENAI",
          modelName: "gpt-5.4",
          openaiApiType: "responses",
        }
      )
    ).toBe(true);
  });

  it("distinguishes the OpenAI API type", () => {
    expect(
      isSameModelSelection(
        {
          providerType: "builtin",
          provider: "OPENAI",
          modelName: "gpt-5.4",
          openaiApiType: "chat_completions",
        },
        {
          providerType: "builtin",
          provider: "OPENAI",
          modelName: "gpt-5.4",
          openaiApiType: "responses",
        }
      )
    ).toBe(false);
  });

  it("distinguishes provider and model name", () => {
    expect(
      isSameModelSelection(
        { providerType: "builtin", provider: "OPENAI", modelName: "gpt-5.4" },
        { providerType: "builtin", provider: "GOOGLE", modelName: "gpt-5.4" }
      )
    ).toBe(false);
    expect(
      isSameModelSelection(
        { providerType: "builtin", provider: "OPENAI", modelName: "gpt-5.4" },
        { providerType: "builtin", provider: "OPENAI", modelName: "gpt-5.5" }
      )
    ).toBe(false);
  });

  it("compares custom selections by provider id and never matches a built-in", () => {
    expect(
      isSameModelSelection(
        { providerType: "custom", providerId: "p1", modelName: "m" },
        { providerType: "custom", providerId: "p1", modelName: "m" }
      )
    ).toBe(true);
    expect(
      isSameModelSelection(
        { providerType: "custom", providerId: "p1", modelName: "m" },
        { providerType: "custom", providerId: "p2", modelName: "m" }
      )
    ).toBe(false);
    expect(
      isSameModelSelection(
        { providerType: "custom", providerId: "p1", modelName: "m" },
        { providerType: "builtin", provider: "OPENAI", modelName: "m" }
      )
    ).toBe(false);
  });
});

describe("PXI model preflight", () => {
  it("uses a valid persisted model when no model flags were provided", async () => {
    const options = createRuntimeOptions({
      provider: undefined,
      model: undefined,
    });
    const persistedModel = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    } as const;
    const { fetchImpl } = createFetch({
      body: { data: createPreflightData() },
    });

    await expect(
      resolveRestoredPxiModelSelection({
        options,
        persistedModelSelection: persistedModel,
        fetchImpl,
      })
    ).resolves.toEqual(persistedModel);
  });

  it("ignores explicit model flags in favour of the persisted selection", async () => {
    // The flags express an intent to *move* the session, applied once as a
    // write when it is restored. Honouring them here as well would make every
    // poll re-assert them and mask model changes from other clients.
    // Flags say gpt-5.4; the session is persisted on a different, still-valid
    // model.
    const options = createRuntimeOptions();
    const persistedModel = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.5",
    } as const;
    const { fetchImpl } = createFetch({
      body: {
        data: createPreflightData({
          playgroundModels: [
            { providerKey: "OPENAI", name: "gpt-5.4" },
            { providerKey: "OPENAI", name: "gpt-5.5" },
          ],
        }),
      },
    });

    await expect(
      resolveRestoredPxiModelSelection({
        options,
        persistedModelSelection: persistedModel,
        fetchImpl,
      })
    ).resolves.toEqual(persistedModel);
  });

  it("keeps an invalid persisted model and surfaces the validation error", async () => {
    // The persisted selection is the source of truth: every send asserts the
    // displayed model, so falling back to the CLI default would make the
    // server reject each send with agent_session_model_stale. The user is
    // warned instead.
    const options = createRuntimeOptions({
      provider: undefined,
      model: undefined,
    });
    const persistedModel = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "missing-model",
    } as const;
    const { fetchImpl } = createFetch({
      body: { data: createPreflightData() },
    });
    const onInvalidModel = vi.fn();

    await expect(
      resolveRestoredPxiModelSelection({
        options,
        persistedModelSelection: persistedModel,
        onInvalidModel,
        fetchImpl,
      })
    ).resolves.toEqual(persistedModel);

    expect(onInvalidModel).toHaveBeenCalledTimes(1);
    expect(onInvalidModel.mock.calls[0]?.[0]?.error?.message).toContain(
      "Invalid model for OpenAI (OPENAI): missing-model"
    );
  });

  it("keeps the persisted model without warning when the catalog fetch fails", async () => {
    // A transient network/500 failure says nothing about the model's
    // validity; treating it as invalid used to swap in the CLI default and
    // put every send into a 409 loop until the preflight recovered.
    const options = createRuntimeOptions({
      provider: undefined,
      model: undefined,
    });
    const persistedModel = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    } as const;
    const fetchImpl: typeof globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const onInvalidModel = vi.fn();

    await expect(
      resolveRestoredPxiModelSelection({
        options,
        persistedModelSelection: persistedModel,
        onInvalidModel,
        fetchImpl,
      })
    ).resolves.toEqual(persistedModel);

    expect(onInvalidModel).not.toHaveBeenCalled();
  });

  it("keeps the persisted model without warning on catalog HTTP errors", async () => {
    const options = createRuntimeOptions({
      provider: undefined,
      model: undefined,
    });
    const persistedModel = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    } as const;
    const { fetchImpl } = createFetch({
      body: { detail: "boom" },
      status: 500,
      statusText: "Internal Server Error",
    });
    const onInvalidModel = vi.fn();

    await expect(
      resolveRestoredPxiModelSelection({
        options,
        persistedModelSelection: persistedModel,
        onInvalidModel,
        fetchImpl,
      })
    ).resolves.toEqual(persistedModel);

    expect(onInvalidModel).not.toHaveBeenCalled();
  });

  it("validates an explicitly passed selection instead of the launch selection", async () => {
    // The restored-session path reuses runPxiModelPreflight by passing the
    // persisted selection; the launch selection must not shadow it.
    const options = createRuntimeOptions();
    const { fetchImpl } = createFetch({
      body: { data: createPreflightData() },
    });

    await expect(
      runPxiModelPreflight({
        options,
        modelSelection: {
          providerType: "builtin",
          provider: "OPENAI",
          modelName: "missing-model",
        },
        fetchImpl,
      })
    ).rejects.toThrow("Invalid model for OpenAI (OPENAI): missing-model");
  });

  it("returns available recommended models in the main app's curated order", () => {
    const models = getRecommendedPxiModels({
      data: createPreflightData({
        playgroundModels: [
          { providerKey: "GOOGLE", name: "gemini-3.5-flash" },
          { providerKey: "OPENAI", name: "unrecommended-model" },
          { providerKey: "OPENAI", name: "gpt-5.4" },
          { providerKey: "ANTHROPIC", name: "claude-opus-4-8" },
        ],
      }),
    });

    expect(models).toEqual([
      {
        providerType: "builtin",
        provider: "ANTHROPIC",
        modelName: "claude-opus-4-8",
      },
      {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.4",
        openaiApiType: "responses",
      },
      {
        providerType: "builtin",
        provider: "GOOGLE",
        modelName: "gemini-3.5-flash",
      },
    ]);
  });

  it("uses configured endpoint, API key, and custom headers", async () => {
    const options = createRuntimeOptions({ apiKey: "secret" });
    options.config.headers = { "X-Phoenix": "pxi" };
    const { fetchImpl, calls } = createFetch({
      body: { data: createPreflightData() },
    });

    await runPxiModelPreflight({ options, fetchImpl });

    expect(calls[0]?.url).toBe("http://localhost:6006/graphql");
    expect(calls[0]?.init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
      "X-Phoenix": "pxi",
    });
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      query: expect.stringContaining("modelProviders"),
    });
  });

  it("bypasses remote checks when model preflight is skipped", async () => {
    const options = createRuntimeOptions({ skipModelPreflight: true });
    const { fetchImpl, calls } = createFetch({
      body: { data: createPreflightData() },
    });

    await runPxiModelPreflight({ options, fetchImpl });

    expect(calls).toHaveLength(0);
  });

  it("blocks built-in providers with missing server credentials", async () => {
    const options = createRuntimeOptions();
    const { fetchImpl } = createFetch({
      body: {
        data: createPreflightData({
          provider: {
            key: "OPENAI",
            name: "OpenAI",
            dependenciesInstalled: true,
            credentialsSet: false,
            credentialRequirements: [
              {
                envVarName: "OPENAI_API_KEY",
                isRequired: true,
              },
            ],
          },
        }),
      },
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "Required server credential variables/secrets: OPENAI_API_KEY"
    );
    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "not the PXI CLI --api-key"
    );
  });

  it("blocks built-in providers without installed server dependencies", async () => {
    const options = createRuntimeOptions();
    const { fetchImpl } = createFetch({
      body: {
        data: createPreflightData({
          provider: {
            key: "OPENAI",
            name: "OpenAI",
            dependenciesInstalled: false,
            credentialsSet: true,
            credentialRequirements: [],
          },
        }),
      },
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "OpenAI (OPENAI) is unavailable because the Phoenix server does not have that provider installed"
    );
  });

  it("blocks built-in models that are not in the Phoenix catalog", async () => {
    const options = createRuntimeOptions({ model: "gpt-missing" });
    const { fetchImpl } = createFetch({
      body: { data: createPreflightData() },
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "Invalid model for OpenAI (OPENAI): gpt-missing. Available models for this provider include: gpt-5.4."
    );
  });

  it("blocks missing custom providers", async () => {
    const options = createRuntimeOptions({
      customProviderId: "provider-1",
      model: "custom-model",
    });
    const { fetchImpl } = createFetch({
      body: { data: createPreflightData() },
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "Custom provider provider-1 was not found"
    );
  });

  it("blocks custom models that are not configured on the provider", async () => {
    const options = createRuntimeOptions({
      customProviderId: "provider-1",
      model: "unknown-model",
    });
    const { fetchImpl } = createFetch({
      body: {
        data: createPreflightData({
          customProviders: [
            {
              id: "provider-1",
              name: "Custom Provider",
              sdk: "openai",
              modelNames: ["custom-model"],
            },
          ],
        }),
      },
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "Invalid model for custom provider Custom Provider (provider-1): unknown-model. Configured model names: custom-model."
    );
  });

  it("formats GraphQL errors as actionable startup errors", async () => {
    const options = createRuntimeOptions();
    const { fetchImpl } = createFetch({
      body: {
        errors: [
          {
            message: "Cannot query field modelProviders",
          },
        ],
      },
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "Use --skip-model-preflight to bypass this startup check"
    );
  });

  it("formats HTTP errors as actionable startup errors", async () => {
    const options = createRuntimeOptions();
    const { fetchImpl } = createFetch({
      body: { detail: "Unauthorized" },
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(runPxiModelPreflight({ options, fetchImpl })).rejects.toThrow(
      "Could not validate PXI model selection: HTTP 401 Unauthorized"
    );
  });

  it("formats endpoint connection failures as actionable startup errors", async () => {
    const options = createRuntimeOptions();
    const fetchImpl: typeof globalThis.fetch = async () => {
      throw new TypeError("fetch failed", {
        cause: new Error("connect ECONNREFUSED 127.0.0.1:6006"),
      });
    };

    let message = "";
    try {
      await runPxiModelPreflight({ options, fetchImpl });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(
      "Could not reach Phoenix during PXI startup preflight."
    );
    expect(message).toContain("Endpoint: http://localhost:6006");
    expect(message).toContain("Request: http://localhost:6006/graphql");
    expect(message).toContain("Network error: fetch failed");
    expect(message).toContain("Cause: connect ECONNREFUSED 127.0.0.1:6006");
    expect(message).toContain("pass --endpoint <url> or set PHOENIX_HOST");
    expect(message).toContain("pass --skip-model-preflight");
  });
});
