import type { PromptInvocationParametersReadableFragment$data } from "../../__generated__/PromptInvocationParametersReadableFragment.graphql";
import {
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  ANTHROPIC_MINIMUM_BUDGET_TOKENS,
  type AnthropicConfig,
  anthropicAdapter,
  anthropicConfigFromPromptInvocationParameters,
  anthropicConfigFromSpanInvocationParameters,
  anthropicConfigToPromptInput,
  getDefaultAnthropicConfig,
  anthropicReadField,
  anthropicWriteField,
  normalizeAnthropicConfig,
  parseAnthropicConfig,
  validateAnthropicConfigForSubmit,
} from "../anthropicAdapter";

describe("parseAnthropicConfig", () => {
  it("fills the default maxTokens when omitted", () => {
    expect(parseAnthropicConfig({})).toEqual({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
    });
  });

  it("preserves recognized canonical keys", () => {
    expect(
      parseAnthropicConfig({
        maxTokens: 4096,
        temperature: 0.4,
        topP: 0.95,
        stopSequences: ["END"],
        effort: "HIGH",
        thinking: { type: "enabled", budgetTokens: 2048 },
        extraBody: { foo: 1 },
      })
    ).toEqual({
      maxTokens: 4096,
      temperature: 0.4,
      topP: 0.95,
      stopSequences: ["END"],
      effort: "HIGH",
      thinking: { type: "enabled", budgetTokens: 2048 },
      extraBody: { foo: 1 },
    });
  });

  it("drops unknown keys", () => {
    const config = parseAnthropicConfig({
      maxTokens: 100,
      unknownField: "ignored",
      somethingElse: 42,
    });
    expect(config).toEqual({ maxTokens: 100 });
    expect(config).not.toHaveProperty("unknownField");
  });

  it("drops malformed fields rather than failing the whole parse", () => {
    expect(
      parseAnthropicConfig({
        maxTokens: "not a number",
        temperature: "also bad",
        topP: 0.5,
      })
    ).toEqual({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
      topP: 0.5,
    });
  });

  it("falls back to default config for non-object input", () => {
    expect(parseAnthropicConfig(null)).toEqual({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
    });
    expect(parseAnthropicConfig("string")).toEqual({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
    });
  });
});

describe("getDefaultAnthropicConfig", () => {
  it("creates the fresh Anthropic playground defaults", () => {
    expect(getDefaultAnthropicConfig()).toEqual({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
      thinking: { type: "adaptive", display: "SUMMARIZED" },
      effort: "HIGH",
    });
  });
});

describe("normalizeAnthropicConfig", () => {
  it("is the identity when thinking is disabled", () => {
    const config: AnthropicConfig = {
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.9,
      thinking: { type: "disabled" },
    };
    expect(normalizeAnthropicConfig(config)).toEqual(config);
  });

  it("strips temperature and topP when thinking is enabled", () => {
    expect(
      normalizeAnthropicConfig({
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9,
        thinking: { type: "enabled", budgetTokens: 2048 },
      })
    ).toEqual({
      maxTokens: 4096,
      thinking: { type: "enabled", budgetTokens: 2048 },
    });
  });

  it("strips temperature and topP when thinking is adaptive", () => {
    expect(
      normalizeAnthropicConfig({
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9,
        thinking: { type: "adaptive" },
      })
    ).toEqual({
      maxTokens: 4096,
      thinking: { type: "adaptive" },
    });
  });

  it("is idempotent", () => {
    const config: AnthropicConfig = {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      thinking: { type: "enabled", budgetTokens: 2048 },
    };
    const once = normalizeAnthropicConfig(config);
    const twice = normalizeAnthropicConfig(once);
    expect(twice).toEqual(once);
  });

  it("parsed-then-normalized canonical input is a fixed point of the parser", () => {
    const config = normalizeAnthropicConfig(
      parseAnthropicConfig({
        maxTokens: 4096,
        temperature: 0.7,
        thinking: { type: "enabled", budgetTokens: 2048 },
      })
    );
    expect(parseAnthropicConfig(config)).toEqual(config);
  });
});

describe("validateAnthropicConfigForSubmit", () => {
  it("returns no errors when thinking is disabled", () => {
    expect(
      validateAnthropicConfigForSubmit({
        maxTokens: 100,
        thinking: { type: "disabled" },
      })
    ).toEqual([]);
  });

  it("returns no errors when thinking is adaptive (no budget to check)", () => {
    expect(
      validateAnthropicConfigForSubmit({
        maxTokens: 100,
        thinking: { type: "adaptive" },
      })
    ).toEqual([]);
  });

  it("rejects budgetTokens below the documented minimum", () => {
    const errors = validateAnthropicConfigForSubmit({
      maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
      thinking: {
        type: "enabled",
        budgetTokens: ANTHROPIC_MINIMUM_BUDGET_TOKENS - 1,
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/budget/i);
  });

  it("rejects budgetTokens >= maxTokens", () => {
    const errors = validateAnthropicConfigForSubmit({
      maxTokens: 2000,
      thinking: { type: "enabled", budgetTokens: 2000 },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /max tokens/i.test(e))).toBe(true);
  });

  it("accepts a valid budget < maxTokens", () => {
    expect(
      validateAnthropicConfigForSubmit({
        maxTokens: 4096,
        thinking: { type: "enabled", budgetTokens: 2048 },
      })
    ).toEqual([]);
  });
});

describe("anthropicConfigToPromptInput", () => {
  it("emits a minimal Anthropic branch with only maxTokens for a default config", () => {
    expect(anthropicConfigToPromptInput({ maxTokens: 1000 })).toEqual({
      anthropic: { maxTokens: 1000 },
    });
  });

  it("emits temperature and topP only when set, never as null", () => {
    const input = anthropicConfigToPromptInput({
      maxTokens: 1000,
      temperature: 0.5,
    });
    expect(input.anthropic?.maxTokens).toBe(1000);
    expect(input.anthropic?.temperature).toBe(0.5);
    expect(input.anthropic).not.toHaveProperty("topP");
  });

  it("normalizes before serializing: temperature and topP are dropped when thinking is enabled", () => {
    const input = anthropicConfigToPromptInput({
      maxTokens: 4096,
      temperature: 0.5,
      topP: 0.9,
      thinking: { type: "enabled", budgetTokens: 2048 },
    });
    expect(input.anthropic).not.toHaveProperty("temperature");
    expect(input.anthropic).not.toHaveProperty("topP");
    expect(input.anthropic?.thinking).toEqual({
      enabled: { budgetTokens: 2048, display: null },
    });
  });

  it("lifts canonical effort back into outputConfig", () => {
    const input = anthropicConfigToPromptInput({
      maxTokens: 1000,
      effort: "HIGH",
    });
    expect(input.anthropic?.outputConfig).toEqual({ effort: "HIGH" });
  });

  it("omits outputConfig when effort is unset", () => {
    const config = anthropicWriteField(
      getDefaultAnthropicConfig(),
      "effort",
      undefined
    );
    expect(anthropicReadField(config, "effort")).toBeUndefined();

    const input = anthropicConfigToPromptInput(config);
    expect(input.anthropic).not.toHaveProperty("outputConfig");
  });

  it("emits each thinking variant in the discriminated-union shape", () => {
    expect(
      anthropicConfigToPromptInput({
        maxTokens: 1000,
        thinking: { type: "disabled" },
      }).anthropic?.thinking
    ).toEqual({ disabled: { disabled: true } });

    expect(
      anthropicConfigToPromptInput({
        maxTokens: 1000,
        thinking: { type: "adaptive", display: "SUMMARIZED" },
      }).anthropic?.thinking
    ).toEqual({ adaptive: { display: "SUMMARIZED" } });
  });

  it("round-trips extraBody as a plain object", () => {
    const input = anthropicConfigToPromptInput({
      maxTokens: 1000,
      extraBody: { foo: 1, nested: { bar: 2 } },
    });
    expect(input.anthropic?.extraBody).toEqual({ foo: 1, nested: { bar: 2 } });
  });

  it("throws when the config fails submit validation", () => {
    expect(() =>
      anthropicConfigToPromptInput({
        maxTokens: 1000,
        thinking: { type: "enabled", budgetTokens: 2000 },
      })
    ).toThrow(/budget/i);
  });
});

describe("anthropicConfigFromPromptInvocationParameters", () => {
  it("reads the Anthropic branch into canonical config", () => {
    const data: PromptInvocationParametersReadableFragment$data = {
      __typename: "PromptAnthropicInvocationParameters",
      anthropicMaxTokens: 4096,
      temperature: 0.7,
      topP: 0.95,
      stopSequences: ["END"],
      outputConfig: { effort: "HIGH" },
      thinking: null,
      extraBody: { foo: 1 },
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    expect(anthropicConfigFromPromptInvocationParameters(data)).toEqual({
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.95,
      stopSequences: ["END"],
      effort: "HIGH",
      extraBody: { foo: 1 },
    });
  });

  it("normalizes after reading: temperature and topP drop when thinking is enabled", () => {
    const data: PromptInvocationParametersReadableFragment$data = {
      __typename: "PromptAnthropicInvocationParameters",
      anthropicMaxTokens: 4096,
      temperature: 0.7,
      topP: 0.95,
      stopSequences: null,
      outputConfig: null,
      thinking: {
        __typename: "PromptAnthropicThinkingEnabled",
        budgetTokens: 2048,
        enabledDisplay: "SUMMARIZED",
      },
      extraBody: null,
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    };
    const config = anthropicConfigFromPromptInvocationParameters(data);
    expect(config).not.toHaveProperty("temperature");
    expect(config).not.toHaveProperty("topP");
    expect(config.thinking).toEqual({
      type: "enabled",
      budgetTokens: 2048,
      display: "SUMMARIZED",
    });
  });

  it("decodes each thinking variant", () => {
    const base = {
      __typename: "PromptAnthropicInvocationParameters" as const,
      anthropicMaxTokens: 4096,
      temperature: null,
      topP: null,
      stopSequences: null,
      outputConfig: null,
      extraBody: null,
      " $fragmentType": "PromptInvocationParametersReadableFragment" as const,
    };
    expect(
      anthropicConfigFromPromptInvocationParameters({
        ...base,
        thinking: {
          __typename: "PromptAnthropicThinkingDisabled",
          disabled: true,
        },
      }).thinking
    ).toEqual({ type: "disabled" });

    expect(
      anthropicConfigFromPromptInvocationParameters({
        ...base,
        thinking: {
          __typename: "PromptAnthropicThinkingAdaptive",
          adaptiveDisplay: "OMITTED",
        },
      }).thinking
    ).toEqual({ type: "adaptive", display: "OMITTED" });
  });

  it("ignores forward-compat `%other` thinking variants", () => {
    const config = anthropicConfigFromPromptInvocationParameters({
      __typename: "PromptAnthropicInvocationParameters",
      anthropicMaxTokens: 4096,
      temperature: null,
      topP: null,
      stopSequences: null,
      outputConfig: null,
      thinking: { __typename: "%other" },
      extraBody: null,
      " $fragmentType": "PromptInvocationParametersReadableFragment",
    });
    expect(config.thinking).toBeUndefined();
  });

  it("throws when called with a non-Anthropic branch", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- intentional non-Anthropic branch fixture exercising the throw path
    const data = {
      __typename: "PromptOpenAIInvocationParameters",
    } as unknown as PromptInvocationParametersReadableFragment$data;
    expect(() => anthropicConfigFromPromptInvocationParameters(data)).toThrow(
      /non-Anthropic/
    );
  });
});

describe("anthropicConfigFromSpanInvocationParameters", () => {
  it("hydrates camelCase canonical config from snake_case span input", () => {
    const { config, promoted } = anthropicConfigFromSpanInvocationParameters({
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 0.95,
      stop_sequences: ["END"],
      thinking: { type: "disabled" },
      output_config: { effort: "HIGH" },
      extra_body: { foo: 1 },
    });
    expect(config).toEqual({
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.95,
      stopSequences: ["END"],
      thinking: { type: "disabled" },
      effort: "HIGH",
      extraBody: { foo: 1 },
    });
    expect(promoted).toEqual({});
  });

  it("promotes output_config.format to responseFormat and keeps effort in invocation config", () => {
    const { config, promoted } = anthropicConfigFromSpanInvocationParameters({
      max_tokens: 4096,
      output_config: {
        effort: "HIGH",
        format: {
          type: "json_schema",
          schema: { type: "object", properties: { name: { type: "string" } } },
        },
      },
    });
    expect(config.effort).toBe("HIGH");
    expect(config).not.toHaveProperty("outputConfig");
    expect(promoted.responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: {
        name: "response",
        schema: { type: "object", properties: { name: { type: "string" } } },
      },
    });
  });

  it("normalizes after hydration: temperature/topP drop when thinking is enabled", () => {
    const { config } = anthropicConfigFromSpanInvocationParameters({
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 0.95,
      thinking: { type: "enabled", budget_tokens: 2048 },
    });
    expect(config).not.toHaveProperty("temperature");
    expect(config).not.toHaveProperty("topP");
    expect(config.thinking).toEqual({ type: "enabled", budgetTokens: 2048 });
  });

  it("returns a default config for non-object input", () => {
    expect(anthropicConfigFromSpanInvocationParameters(null)).toEqual({
      config: { maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS },
      promoted: {},
    });
  });
});

describe("anthropicAdapter object surface", () => {
  it("re-exports each function on the adapter object", () => {
    expect(anthropicAdapter.getDefaultConfig).toBe(getDefaultAnthropicConfig);
    expect(anthropicAdapter.parseConfig).toBe(parseAnthropicConfig);
    expect(anthropicAdapter.normalize).toBe(normalizeAnthropicConfig);
    expect(anthropicAdapter.validateForSubmit).toBe(
      validateAnthropicConfigForSubmit
    );
    expect(anthropicAdapter.toPromptInput).toBe(anthropicConfigToPromptInput);
    expect(anthropicAdapter.fromPromptInvocationParameters).toBe(
      anthropicConfigFromPromptInvocationParameters
    );
    expect(anthropicAdapter.fromSpanInvocationParameters).toBe(
      anthropicConfigFromSpanInvocationParameters
    );
    expect(anthropicAdapter.readField).toBe(anthropicReadField);
    expect(anthropicAdapter.writeField).toBe(anthropicWriteField);
  });
});

describe("anthropicReadField / anthropicWriteField", () => {
  const base: AnthropicConfig = { maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS };

  it("projects top-level leaves and the nested thinking sub-fields", () => {
    const config: AnthropicConfig = {
      maxTokens: 4096,
      temperature: 0.5,
      topP: 0.9,
      thinking: {
        type: "enabled",
        budgetTokens: 1024,
        display: "SUMMARIZED",
      },
      effort: "HIGH",
      extraBody: { foo: 1 },
    };
    expect(anthropicReadField(config, "maxTokens")).toBe(4096);
    expect(anthropicReadField(config, "temperature")).toBe(0.5);
    expect(anthropicReadField(config, "topP")).toBe(0.9);
    expect(anthropicReadField(config, "thinkingType")).toBe("enabled");
    expect(anthropicReadField(config, "thinkingBudgetTokens")).toBe(1024);
    expect(anthropicReadField(config, "thinkingDisplay")).toBe("summarized");
    expect(anthropicReadField(config, "effort")).toBe("high");
    expect(anthropicReadField(config, "extraBody")).toEqual({ foo: 1 });
  });

  it("returns undefined for leaves not reachable in the current config", () => {
    expect(
      anthropicReadField(
        { ...base, thinking: { type: "adaptive" } },
        "thinkingBudgetTokens"
      )
    ).toBeUndefined();
    expect(
      anthropicReadField(
        { ...base, thinking: { type: "disabled" } },
        "thinkingDisplay"
      )
    ).toBeUndefined();
    expect(anthropicReadField(base, "thinkingType")).toBeUndefined();
  });

  it("flipping thinkingType=enabled defaults budget to the documented minimum", () => {
    const config = anthropicWriteField(base, "thinkingType", "enabled");
    expect(config.thinking).toEqual({
      type: "enabled",
      budgetTokens: ANTHROPIC_MINIMUM_BUDGET_TOKENS,
    });
  });

  it("flipping thinkingType=enabled bumps maxTokens when it would block the budget", () => {
    const tooSmall: AnthropicConfig = { maxTokens: 500 };
    const config = anthropicWriteField(tooSmall, "thinkingType", "enabled");
    expect(config.thinking).toEqual({
      type: "enabled",
      budgetTokens: ANTHROPIC_MINIMUM_BUDGET_TOKENS,
    });
    expect(config.maxTokens).toBeGreaterThan(ANTHROPIC_MINIMUM_BUDGET_TOKENS);
    expect(validateAnthropicConfigForSubmit(config)).toEqual([]);
  });

  it("flipping thinkingType=enabled preserves maxTokens when already valid", () => {
    const config = anthropicWriteField(base, "thinkingType", "enabled");
    expect(config.maxTokens).toBe(ANTHROPIC_DEFAULT_MAX_TOKENS);
  });

  it("flipping thinkingType preserves display across enabled/adaptive", () => {
    const enabled = anthropicWriteField(base, "thinkingType", "enabled");
    const withDisplay = anthropicWriteField(
      enabled,
      "thinkingDisplay",
      "omitted"
    );
    const adaptive = anthropicWriteField(
      withDisplay,
      "thinkingType",
      "adaptive"
    );
    expect(adaptive.thinking).toEqual({ type: "adaptive", display: "OMITTED" });
  });

  it("flipping thinkingType=disabled strips budget and display", () => {
    const enabled = anthropicWriteField(base, "thinkingType", "enabled");
    const withDisplay = anthropicWriteField(
      enabled,
      "thinkingDisplay",
      "omitted"
    );
    const disabled = anthropicWriteField(
      withDisplay,
      "thinkingType",
      "disabled"
    );
    expect(disabled.thinking).toEqual({ type: "disabled" });
  });

  it("writing thinkingBudgetTokens is ignored when thinking is not enabled", () => {
    const adaptive = anthropicWriteField(base, "thinkingType", "adaptive");
    const attempt = anthropicWriteField(adaptive, "thinkingBudgetTokens", 4096);
    expect(attempt.thinking).toEqual({ type: "adaptive" });
  });

  it("writing temperature is dropped at normalize time when thinking is active", () => {
    const enabled = anthropicWriteField(base, "thinkingType", "enabled");
    const withTemp = anthropicWriteField(enabled, "temperature", 0.7);
    expect(withTemp).not.toHaveProperty("temperature");
  });

  it("rejects NaN numeric writes", () => {
    const config = anthropicWriteField(base, "temperature", NaN);
    expect(config.temperature).toBeUndefined();
  });

  it("normalizes effort casing on write", () => {
    const config = anthropicWriteField(base, "effort", "max");
    expect(config.effort).toBe("MAX");
    expect(anthropicReadField(config, "effort")).toBe("max");
  });

  it("clears extraBody with undefined", () => {
    const set = anthropicWriteField(base, "extraBody", { foo: 1 });
    const cleared = anthropicWriteField(set, "extraBody", undefined);
    expect(anthropicReadField(cleared, "extraBody")).toBeUndefined();
  });
});
