import { describe, expect, it } from "vitest";

import { getAgentModelKey } from "../agentModelConfig";
import {
  type AgentModelCatalogInput,
  buildAgentModelCatalog,
  buildAgentModelProviderOptions,
  getAgentModelFreeTextTarget,
  getAgentModelHighlightRanges,
  inferProviderFromModelName,
  MATCH_SCORE,
  rankAgentModels,
  resolveAgentModelRow,
  toAgentModelMenuValue,
  tokenMatchScore,
} from "../agentModelSearch";

type ModelProviderInput = AgentModelCatalogInput["modelProviders"][number];

function makeProvider(
  overrides: Partial<ModelProviderInput> & Pick<ModelProviderInput, "key">
): ModelProviderInput {
  return {
    name: overrides.key,
    dependenciesInstalled: true,
    credentialsSet: false,
    ...overrides,
  };
}

const MODEL_PROVIDERS: ModelProviderInput[] = [
  makeProvider({ key: "OPENAI", name: "OpenAI", credentialsSet: true }),
  makeProvider({ key: "ANTHROPIC", name: "Anthropic", credentialsSet: true }),
  makeProvider({ key: "AWS", name: "AWS Bedrock" }),
  makeProvider({ key: "AZURE_OPENAI", name: "Azure OpenAI" }),
  makeProvider({ key: "GOOGLE", name: "Google" }),
  makeProvider({ key: "OLLAMA", name: "Ollama" }),
  makeProvider({ key: "XAI", name: "xAI", dependenciesInstalled: false }),
];

const PLAYGROUND_MODELS: AgentModelCatalogInput["playgroundModels"] = [
  { providerKey: "OPENAI", name: "gpt-4o" },
  { providerKey: "OPENAI", name: "gpt-4o-mini" },
  { providerKey: "OPENAI", name: "gpt-5.4" },
  { providerKey: "OPENAI", name: "gpt-5.4-mini" },
  { providerKey: "ANTHROPIC", name: "claude-opus-5" },
  { providerKey: "ANTHROPIC", name: "claude-opus-4-6" },
  { providerKey: "ANTHROPIC", name: "claude-opus-4-20250514" },
  { providerKey: "AWS", name: "us.anthropic.claude-opus-4-6-v1:0" },
  { providerKey: "AWS", name: "anthropic.claude-opus-4-20250514-v1:0" },
  { providerKey: "GOOGLE", name: "gemini-3.1-pro-preview" },
  { providerKey: "GOOGLE", name: "gemini-2.5-flash" },
  { providerKey: "OLLAMA", name: "llama3.2:3b" },
  { providerKey: "XAI", name: "grok-4" },
];

const CUSTOM_PROVIDERS: AgentModelCatalogInput["customProviders"] = [
  {
    id: "custom-acme",
    name: "Acme gateway",
    sdk: "OPENAI",
    modelNames: ["acme/gpt-5.4-internal", "gpt-4o"],
  },
];

const INPUT: AgentModelCatalogInput = {
  playgroundModels: PLAYGROUND_MODELS,
  modelProviders: MODEL_PROVIDERS,
  customProviders: CUSTOM_PROVIDERS,
};

const ROWS = buildAgentModelCatalog(INPUT);
const PROVIDERS = buildAgentModelProviderOptions(INPUT);

function search(
  query: string,
  options: Omit<Parameters<typeof rankAgentModels>[0], "rows" | "query"> = {}
) {
  return rankAgentModels({ rows: ROWS, query, ...options }).map(
    (row) => row.key
  );
}

describe("buildAgentModelCatalog", () => {
  it("leaves out providers whose dependencies aren't installed", () => {
    expect(ROWS.some((row) => row.provider === "XAI")).toBe(false);
    expect(PROVIDERS.some((option) => option.provider === "XAI")).toBe(false);
  });

  it("leaves out models whose provider isn't listed", () => {
    const rows = buildAgentModelCatalog({
      ...INPUT,
      playgroundModels: [{ providerKey: "MOONSHOT", name: "kimi-k2" }],
      customProviders: [],
    });
    expect(rows).toEqual([]);
  });

  it("derives credential state from server credentials", () => {
    const stateByProvider = Object.fromEntries(
      PROVIDERS.filter((option) => !option.customProvider).map((option) => [
        option.provider,
        option.credentialState,
      ])
    );
    expect(stateByProvider).toEqual({
      OPENAI: "ready",
      ANTHROPIC: "ready",
      // Default credential chain: may work without explicit credentials
      AWS: "may-work",
      AZURE_OPENAI: "may-work",
      GOOGLE: "no-key",
      // Needs no credentials at all
      OLLAMA: "ready",
    });
  });

  it("treats AWS and Azure as ready once credentials are set", () => {
    const options = buildAgentModelProviderOptions({
      modelProviders: [
        makeProvider({ key: "AWS", credentialsSet: true }),
        makeProvider({ key: "AZURE_OPENAI", credentialsSet: true }),
      ],
      customProviders: [],
    });
    expect(options.map((option) => option.credentialState)).toEqual([
      "ready",
      "ready",
    ]);
  });

  it("marks curated rows and gives them display names", () => {
    const curated = ROWS.find((row) => row.key === "ANTHROPIC:claude-opus-4-6");
    expect(curated).toMatchObject({
      isCurated: true,
      displayName: "Claude Opus 4.6",
      providerName: "Anthropic",
      customProvider: null,
    });
    const other = ROWS.find((row) => row.key === "OPENAI:gpt-4o");
    expect(other).toMatchObject({ isCurated: false, displayName: null });
  });

  it("adds custom provider models as ready, uncurated rows", () => {
    const customRows = ROWS.filter((row) => row.customProvider);
    expect(customRows).toEqual([
      {
        key: "custom:custom-acme:acme/gpt-5.4-internal",
        provider: "OPENAI",
        customProvider: { id: "custom-acme", name: "Acme gateway" },
        providerName: "Acme gateway",
        modelName: "acme/gpt-5.4-internal",
        isCurated: false,
        displayName: null,
        credentialState: "ready",
      },
      expect.objectContaining({
        key: "custom:custom-acme:gpt-4o",
        isCurated: false,
      }),
    ]);
    expect(toAgentModelMenuValue(customRows[0])).toEqual({
      provider: "OPENAI",
      modelName: "acme/gpt-5.4-internal",
      customProvider: { id: "custom-acme", name: "Acme gateway" },
    });
  });
});

describe("tokenMatchScore", () => {
  it("matches tokens at word starts, ignoring separators", () => {
    expect(
      tokenMatchScore({ name: "claude-opus-5", query: "opus 5" })
    ).not.toBeNull();
    expect(
      tokenMatchScore({ name: "gpt-4o-mini", query: "4o mini" })
    ).not.toBeNull();
    expect(
      tokenMatchScore({ name: "claude-opus-5", query: "opus5" })
    ).not.toBeNull();
    expect(
      tokenMatchScore({ name: "claude-opus-4-20250514", query: "opus 5" })
    ).toBeNull();
  });

  it("still matches a plain substring", () => {
    expect(tokenMatchScore({ name: "gpt-4o-mini", query: "o-mi" })).toBe(50);
    expect(tokenMatchScore({ name: "gemini-2.5-flash", query: "lash" })).toBe(
      50
    );
  });

  it("scores exact over prefix over substring over tokens", () => {
    const exact = tokenMatchScore({ name: "gpt-4o", query: "GPT-4o" });
    const prefix = tokenMatchScore({ name: "gpt-4o-mini", query: "gpt-4o" });
    const substring = tokenMatchScore({ name: "gpt-4o-mini", query: "4o" });
    const tokens = tokenMatchScore({ name: "gpt-4o-mini", query: "4o mini" });
    expect(exact).toBeGreaterThan(prefix ?? 0);
    expect(prefix).toBeGreaterThan(substring ?? 0);
    expect(substring).toBeGreaterThan(tokens ?? 0);
  });

  it("ignores a Bedrock prefix for exact and prefix matches", () => {
    expect(
      tokenMatchScore({
        name: "us.anthropic.claude-opus-4-6-v1:0",
        query: "claude-opus",
      })
    ).toBe(tokenMatchScore({ name: "claude-opus-4-6", query: "claude-opus" }));
  });

  it.each(["us", "eu", "apac", "global", "jp", "us-gov"])(
    "ignores the `%s.` Bedrock region prefix",
    (region) => {
      const name = `${region}.anthropic.claude-opus-4-6-v1:0`;
      expect(tokenMatchScore({ name, query: "claude-opus" })).toBe(
        MATCH_SCORE.prefix
      );
      expect(tokenMatchScore({ name, query: "claude-opus-4-6-v1:0" })).toBe(
        MATCH_SCORE.exact
      );
    }
  );

  it("doesn't match an empty query", () => {
    expect(tokenMatchScore({ name: "gpt-4o", query: "  " })).toBeNull();
  });
});

describe("rankAgentModels", () => {
  it("finds `opus 5` and `4o mini`", () => {
    expect(search("opus 5")).toEqual(["ANTHROPIC:claude-opus-5"]);
    expect(search("4o mini")).toEqual(["OPENAI:gpt-4o-mini"]);
  });

  it("matches curated display names", () => {
    expect(search("opus 4.6")[0]).toBe("ANTHROPIC:claude-opus-4-6");
  });

  it("ranks Anthropic above AWS Bedrock for `opus`", () => {
    const results = search("opus");
    const anthropicIndex = results.indexOf("ANTHROPIC:claude-opus-4-6");
    const bedrockIndex = results.indexOf(
      "AWS:us.anthropic.claude-opus-4-6-v1:0"
    );
    expect(anthropicIndex).toBeGreaterThanOrEqual(0);
    expect(bedrockIndex).toBeGreaterThan(anthropicIndex);
    // Uncurated, same match quality: ready Anthropic beats may-work Bedrock
    expect(results.indexOf("ANTHROPIC:claude-opus-4-20250514")).toBeLessThan(
      results.indexOf("AWS:anthropic.claude-opus-4-20250514-v1:0")
    );
  });

  it("ranks no-key providers lower but still lists them", () => {
    const rows = buildAgentModelCatalog({
      playgroundModels: [
        { providerKey: "GOOGLE", name: "model-x" },
        { providerKey: "AWS", name: "model-x-v2" },
        { providerKey: "OPENAI", name: "model-x-v3" },
      ],
      modelProviders: MODEL_PROVIDERS,
      customProviders: [],
    });
    expect(rankAgentModels({ rows, query: "x" }).map((row) => row.key)).toEqual(
      ["OPENAI:model-x-v3", "AWS:model-x-v2", "GOOGLE:model-x"]
    );
  });

  it("puts match quality ahead of curated and credentials", () => {
    // `gpt-4o` is an uncurated exact match; `gpt-4o-mini` only a prefix
    expect(search("gpt-4o")).toEqual([
      "OPENAI:gpt-4o",
      "custom:custom-acme:gpt-4o",
      "OPENAI:gpt-4o-mini",
    ]);
  });

  it("breaks ties with recency", () => {
    const recentModelKeys = [
      getAgentModelKey({ provider: "OPENAI", modelName: "gpt-4o-mini" }),
    ];
    expect(search("4o", { recentModelKeys })[0]).toBe("OPENAI:gpt-4o-mini");
    expect(search("4o")[0]).toBe("OPENAI:gpt-4o");
  });

  it("includes custom provider rows", () => {
    expect(search("internal")).toEqual([
      "custom:custom-acme:acme/gpt-5.4-internal",
    ]);
  });

  it("limits results to a built-in provider scope", () => {
    expect(
      search("gpt", { scope: { provider: "OPENAI", customProviderId: null } })
    ).toEqual([
      "OPENAI:gpt-5.4-mini",
      "OPENAI:gpt-4o",
      "OPENAI:gpt-5.4",
      "OPENAI:gpt-4o-mini",
    ]);
  });

  it("limits results to a custom provider scope", () => {
    expect(
      search("gpt", {
        scope: { provider: "OPENAI", customProviderId: "custom-acme" },
      })
    ).toEqual([
      "custom:custom-acme:gpt-4o",
      "custom:custom-acme:acme/gpt-5.4-internal",
    ]);
  });

  it("lists a scope's models with an empty query, and nothing without one", () => {
    expect(
      search("", { scope: { provider: "GOOGLE", customProviderId: null } })
    ).toEqual(["GOOGLE:gemini-3.1-pro-preview", "GOOGLE:gemini-2.5-flash"]);
    expect(search("")).toEqual([]);
  });

  it("caps results at 8 by default", () => {
    const rows = buildAgentModelCatalog({
      playgroundModels: Array.from({ length: 12 }, (_, index) => ({
        providerKey: "OPENAI" as const,
        name: `gpt-test-${index}`,
      })),
      modelProviders: MODEL_PROVIDERS,
      customProviders: [],
    });
    expect(rankAgentModels({ rows, query: "gpt" })).toHaveLength(8);
    expect(rankAgentModels({ rows, query: "gpt", limit: 3 })).toHaveLength(3);
  });
});

describe("inferProviderFromModelName", () => {
  it.each([
    ["claude-opus-9", "ANTHROPIC"],
    ["gpt-9-preview", "OPENAI"],
    ["o5-mini", "OPENAI"],
    ["chatgpt-4o-latest", "OPENAI"],
    ["gemini-4-pro", "GOOGLE"],
    ["grok-5", "XAI"],
    ["deepseek-chat", "DEEPSEEK"],
    ["us.anthropic.claude-opus-4-8-v1:0", "AWS"],
    ["eu.amazon.nova-pro-v1:0", "AWS"],
    ["apac.anthropic.claude-sonnet-4-6-v1:0", "AWS"],
    ["global.anthropic.claude-opus-4-8-v1:0", "AWS"],
    ["us-gov.anthropic.claude-sonnet-4-6-v1:0", "AWS"],
    ["anthropic.claude-opus-4-8-v1:0", "AWS"],
    ["llama3.2:3b", "OLLAMA"],
  ] as const)("guesses %s -> %s", (modelName, provider) => {
    expect(inferProviderFromModelName(modelName)).toBe(provider);
  });

  it("returns null when there's no telling", () => {
    expect(inferProviderFromModelName("my-azure-deployment")).toBeNull();
    expect(inferProviderFromModelName("")).toBeNull();
  });
});

describe("getAgentModelFreeTextTarget", () => {
  function getTarget(
    query: string,
    options: Partial<Parameters<typeof getAgentModelFreeTextTarget>[0]> = {}
  ) {
    return getAgentModelFreeTextTarget({
      query,
      rows: ROWS,
      providers: PROVIDERS,
      ...options,
    });
  }

  it("offers nothing for an empty query or one with spaces", () => {
    expect(getTarget("  ")).toBeNull();
    expect(getTarget("opus 5")).toBeNull();
  });

  it("is suppressed by an exact catalog id", () => {
    expect(getTarget("gpt-4o")).toBeNull();
    expect(getTarget(" claude-opus-5 ")).toBeNull();
  });

  it("treats an id that differs only in case as an exact match", () => {
    expect(getTarget("Claude-Opus-4-6")).toBeNull();
    expect(getTarget("GPT-4O")).toBeNull();
  });

  it("only counts exact ids within the scope", () => {
    expect(
      getTarget("gpt-5.4", {
        scope: { provider: "OPENAI", customProviderId: "custom-acme" },
      })
    ).toMatchObject({
      modelName: "gpt-5.4",
      reason: "scope",
      provider: { key: "custom:custom-acme" },
    });
  });

  it("targets the scope over a guess", () => {
    expect(
      getTarget("claude-opus-9", {
        scope: { provider: "AWS", customProviderId: null },
      })
    ).toMatchObject({ reason: "scope", provider: { provider: "AWS" } });
  });

  it("targets the guessed provider, even without a key", () => {
    expect(getTarget("claude-opus-9")).toMatchObject({
      modelName: "claude-opus-9",
      reason: "guess",
      provider: { provider: "ANTHROPIC", customProvider: null },
    });
    expect(getTarget("gemini-4-pro")).toMatchObject({
      reason: "guess",
      provider: { provider: "GOOGLE", credentialState: "no-key" },
    });
  });

  it("falls back to the first ready provider", () => {
    expect(getTarget("my-azure-deployment")).toMatchObject({
      reason: "first-ready",
      provider: { provider: "OPENAI" },
    });
    // xAI is guessed but not installed
    expect(getTarget("grok-5")).toMatchObject({
      reason: "first-ready",
      provider: { provider: "OPENAI" },
    });
  });

  it("falls back to a may-work provider when none is ready", () => {
    const providers = buildAgentModelProviderOptions({
      modelProviders: [
        makeProvider({ key: "GOOGLE" }),
        makeProvider({ key: "AZURE_OPENAI" }),
      ],
      customProviders: [],
    });
    expect(getTarget("my-deployment", { rows: [], providers })).toMatchObject({
      reason: "first-ready",
      provider: { provider: "AZURE_OPENAI" },
    });
    expect(
      getTarget("my-deployment", {
        rows: [],
        providers: providers.filter(
          (option) => option.credentialState === "no-key"
        ),
      })
    ).toBeNull();
  });
});

describe("resolveAgentModelRow", () => {
  function resolve(model: Parameters<typeof resolveAgentModelRow>[0]["model"]) {
    return resolveAgentModelRow({ model, rows: ROWS, providers: PROVIDERS });
  }

  it("returns the catalog row for a listed model", () => {
    const row = resolve({
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
    });
    expect(row).toBe(
      ROWS.find(
        (catalogRow) =>
          catalogRow.key ===
          getAgentModelKey({
            provider: "ANTHROPIC",
            modelName: "claude-opus-4-6",
          })
      )
    );
  });

  it("builds a row for a typed name from its provider", () => {
    expect(resolve({ provider: "OPENAI", modelName: "gpt-9-preview" })).toEqual(
      {
        key: "OPENAI:gpt-9-preview",
        provider: "OPENAI",
        customProvider: null,
        providerName: "OpenAI",
        modelName: "gpt-9-preview",
        isCurated: false,
        displayName: null,
        credentialState: "ready",
      }
    );
  });

  it("keeps a curated display name for a model missing from the catalog", () => {
    expect(
      resolve({ provider: "GOOGLE", modelName: "gemini-3.7-flash" })
    ).toMatchObject({
      isCurated: true,
      displayName: "Gemini 3.7 Flash",
      credentialState: "no-key",
    });
  });

  it("marks a deleted custom provider as missing", () => {
    expect(
      resolve({
        provider: "OPENAI",
        modelName: "acme/gone",
        customProvider: { id: "custom-gone", name: "Deleted provider" },
      })
    ).toMatchObject({
      providerName: "Deleted provider",
      credentialState: "no-key",
      isProviderMissing: true,
    });
  });

  it("treats a provider without dependencies as no-key", () => {
    // Named by `getProviderName`, since only installed providers have options
    expect(resolve({ provider: "XAI", modelName: "grok-4" })).toMatchObject({
      providerName: "XAI",
      credentialState: "no-key",
    });
  });
});

describe("getAgentModelHighlightRanges", () => {
  it("marks the whole query when it appears as is", () => {
    expect(
      getAgentModelHighlightRanges({ text: "claude-opus-5", query: "Opus-5" })
    ).toEqual([[7, 13]]);
  });

  it("marks each token, preferring word starts", () => {
    expect(
      getAgentModelHighlightRanges({ text: "claude-opus-4-5", query: "opus 5" })
    ).toEqual([
      [7, 11],
      [14, 15],
    ]);
    expect(
      getAgentModelHighlightRanges({ text: "gpt-4o-mini", query: "4o mini" })
    ).toEqual([
      [4, 6],
      [7, 11],
    ]);
  });

  it("marks nothing for an empty or unmatched query", () => {
    expect(
      getAgentModelHighlightRanges({ text: "gpt-4o", query: " " })
    ).toEqual([]);
    expect(
      getAgentModelHighlightRanges({ text: "gpt-4o", query: "claude" })
    ).toEqual([]);
  });
});
