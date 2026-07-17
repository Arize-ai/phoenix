import { describe, expect, it } from "vitest";

import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import {
  MIN_SERVER_VERSION_FOR_AGENT_CHAT,
  resolvePxiChatRoute,
  runPxiModelPreflight,
  runPxiStartupPreflight,
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

describe("PXI model preflight", () => {
  it("selects persisted chat for a supported server", async () => {
    const route = await resolvePxiChatRoute({
      client: { getServerVersion: async () => [18, 0, 0] },
    });

    expect(MIN_SERVER_VERSION_FOR_AGENT_CHAT).toEqual([18, 0, 0]);
    expect(route).toBe("persisted");
  });

  it("selects legacy chat for an older server", async () => {
    const route = await resolvePxiChatRoute({
      client: { getServerVersion: async () => [17, 14, 0] },
    });

    expect(route).toBe("legacy");
  });

  it("selects legacy chat when server version detection fails", async () => {
    const route = await resolvePxiChatRoute({
      client: {
        getServerVersion: async () => {
          throw new Error("version endpoint unavailable");
        },
      },
    });

    expect(route).toBe("legacy");
  });

  it("returns startup options with the resolved chat protocol", async () => {
    const options = createRuntimeOptions();
    const fetchImpl: typeof globalThis.fetch = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/arize_phoenix_version")) {
        return new Response("18.0.0");
      }
      return new Response(JSON.stringify({ data: createPreflightData() }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    const resolvedOptions = await runPxiStartupPreflight({
      options,
      fetchImpl,
    });

    expect(options.chatRoute).toBe("legacy");
    expect(resolvedOptions.chatRoute).toBe("persisted");
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
