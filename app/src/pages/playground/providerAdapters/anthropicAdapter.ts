/**
 * Anthropic provider invocation adapter.
 *
 * Provider constraints belong here because they affect the semantic config sent
 * to Anthropic, not the generic form rows used to edit it. The adapter owns
 * Anthropic defaults, cross-field invariants, prompt/span translation, and
 * display projection so every boundary uses the same provider rules. The store
 * keeps the normalized config produced here for edit/run paths, while read-only
 * prompt display projects persisted data faithfully for debugging.
 */

import { z } from "zod";

import type { CanonicalResponseFormat } from "@phoenix/store/playground/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import type {
  AnthropicOutputConfigEffort,
  AnthropicThinkingDisplay,
  PromptAnthropicInvocationParametersInput,
  PromptAnthropicThinkingConfigInput,
  PromptInvocationParametersInput,
} from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import {
  ANTHROPIC_OUTPUT_CONFIG_EFFORT_VALUES,
  ANTHROPIC_THINKING_DISPLAY_VALUES,
} from "../invocationParameterEnumOptions";
import {
  ANTHROPIC_INVOCATION_PARAMETERS,
  type ParamSpec,
} from "../invocationParameterSpecs";
import type { ProviderInvocationAdapter } from "./types";

// ---------- canonical types ---------------------------------------------------

export type AnthropicThinkingDisabled = { type: "disabled" };
export type AnthropicThinkingEnabled = {
  type: "enabled";
  budgetTokens: number;
  display?: AnthropicThinkingDisplay;
};
export type AnthropicThinkingAdaptive = {
  type: "adaptive";
  display?: AnthropicThinkingDisplay;
};
export type AnthropicThinking =
  | AnthropicThinkingDisabled
  | AnthropicThinkingEnabled
  | AnthropicThinkingAdaptive;

/**
 * Canonical Anthropic invocation config. Deliberately does NOT contain
 * `outputConfig`: `effort` is lifted to a top-level invocation field and
 * `format` is split out at hydration time into the promoted response-format
 * playground concept (see `fromSpanInvocationParameters`).
 *
 * `maxTokens` is required to mirror the GraphQL prompt input contract
 * (`PromptAnthropicInvocationParametersInput.maxTokens: number`).
 */
export type AnthropicConfig = {
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  thinking?: AnthropicThinking;
  effort?: AnthropicOutputConfigEffort;
  extraBody?: Record<string, unknown>;
};

export type PromotedPlaygroundFields = {
  responseFormat?: CanonicalResponseFormat;
};

// ---------- constants --------------------------------------------------------

/**
 * Anthropic's documented minimum for `thinking.budget_tokens`. The generic
 * form specs use this value for the Budget Tokens field, and submit validation
 * enforces the same floor.
 */
export const ANTHROPIC_MINIMUM_BUDGET_TOKENS = 1024;

/**
 * Default for `maxTokens` when parsing canonical input that omits it. Chosen
 * above the default thinking budget so enabling extended thinking starts from
 * a valid `budget < maxTokens` configuration.
 */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 2000;
/**
 * Fresh Anthropic playground instances start in adaptive thinking mode. This is
 * applied only by `getDefaultInvocationConfig`, not by `parseAnthropicConfig`,
 * so loading a saved config with thinking intentionally unset keeps it unset.
 */
export const ANTHROPIC_DEFAULT_THINKING: AnthropicThinkingAdaptive = {
  type: "adaptive",
  display: "SUMMARIZED",
};
export const ANTHROPIC_DEFAULT_EFFORT: AnthropicOutputConfigEffort = "HIGH";

// ---------- zod helpers ------------------------------------------------------

// Display values arrive lowercase from the form widget but uppercase from the
// GraphQL prompt union and span payloads. Accept either and store the canonical
// GraphQL-enum casing.
const thinkingDisplaySchema = z
  .string()
  .transform((s) => s.toUpperCase())
  .pipe(z.enum(ANTHROPIC_THINKING_DISPLAY_VALUES))
  .optional()
  .catch(undefined);

// Effort values arrive lowercase from AnthropicEffortConfigField but uppercase
// from GraphQL enum reads. Same canonicalization as thinking display.
const effortSchema = z
  .string()
  .transform((s) => s.toUpperCase())
  .pipe(z.enum(ANTHROPIC_OUTPUT_CONFIG_EFFORT_VALUES))
  .optional()
  .catch(undefined);

const stopSequencesSchema = z.array(z.string()).optional().catch(undefined);

const extraBodySchema = z
  .record(z.string(), z.unknown())
  .optional()
  .catch(undefined);

/** Canonical (camelCase) thinking schema, used by `parseConfig`. */
const canonicalThinkingSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("disabled") }),
    z.object({
      type: z.literal("enabled"),
      budgetTokens: z.number(),
      display: thinkingDisplaySchema,
    }),
    z.object({
      type: z.literal("adaptive"),
      display: thinkingDisplaySchema,
    }),
  ])
  .optional()
  .catch(undefined);

/** Span (snake_case) thinking schema, used by `fromSpanInvocationParameters`. */
const spanThinkingSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("disabled") }),
    z.object({
      type: z.literal("enabled"),
      budget_tokens: z.number(),
      display: thinkingDisplaySchema,
    }),
    z.object({
      type: z.literal("adaptive"),
      display: thinkingDisplaySchema,
    }),
  ])
  .optional()
  .catch(undefined);

function spanThinkingToCanonical(
  thinking: z.infer<typeof spanThinkingSchema>
): AnthropicThinking | undefined {
  if (!thinking) return undefined;
  switch (thinking.type) {
    case "disabled":
      return { type: "disabled" };
    case "enabled": {
      const out: AnthropicThinkingEnabled = {
        type: "enabled",
        budgetTokens: thinking.budget_tokens,
      };
      if (thinking.display !== undefined) out.display = thinking.display;
      return out;
    }
    case "adaptive": {
      const out: AnthropicThinkingAdaptive = { type: "adaptive" };
      if (thinking.display !== undefined) out.display = thinking.display;
      return out;
    }
    default:
      return assertUnreachable(thinking);
  }
}

function isThinkingActive(thinking: AnthropicThinking | undefined): boolean {
  return thinking?.type === "enabled" || thinking?.type === "adaptive";
}

// ---------- parseConfig ------------------------------------------------------

export function getDefaultAnthropicConfig(): AnthropicConfig {
  return {
    maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
    thinking: ANTHROPIC_DEFAULT_THINKING,
    effort: ANTHROPIC_DEFAULT_EFFORT,
  };
}

export function getVisibleAnthropicSpecs(
  config: AnthropicConfig | undefined
): readonly ParamSpec[] {
  if (config == null) {
    return ANTHROPIC_INVOCATION_PARAMETERS;
  }
  const thinkingActive = isThinkingActive(config.thinking);
  return ANTHROPIC_INVOCATION_PARAMETERS.flatMap((spec): ParamSpec[] => {
    const canonicalName = "canonicalName" in spec ? spec.canonicalName : null;
    if (
      thinkingActive &&
      (canonicalName === "TEMPERATURE" || canonicalName === "TOP_P")
    ) {
      return [];
    }
    if (spec.name === "thinkingBudgetTokens") {
      if (config.thinking?.type !== "enabled") return [];
      if (spec.type === "int") {
        return [{ ...spec, max: config.maxTokens - 1 }];
      }
      return [spec];
    }
    if (spec.name === "thinkingDisplay" && !thinkingActive) {
      return [];
    }
    return [spec];
  });
}

const canonicalConfigSchema = z.looseObject({
  maxTokens: z.number().optional().catch(undefined),
  temperature: z.number().optional().catch(undefined),
  topP: z.number().optional().catch(undefined),
  stopSequences: stopSequencesSchema,
  thinking: canonicalThinkingSchema,
  effort: effortSchema,
  extraBody: extraBodySchema,
});

/**
 * Parse editable or saved Anthropic-shaped input into an `AnthropicConfig`.
 * Unknown keys are dropped. Output is NOT yet normalized — callers should run
 * `normalize` next.
 */
export function parseAnthropicConfig(raw: unknown): AnthropicConfig {
  const parsed = canonicalConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: AnthropicConfig = {
    maxTokens: input.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
  };
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.topP !== undefined) config.topP = input.topP;
  if (input.stopSequences !== undefined)
    config.stopSequences = [...input.stopSequences];
  if (input.thinking !== undefined) config.thinking = input.thinking;
  if (input.effort !== undefined) config.effort = input.effort;
  if (input.extraBody !== undefined) config.extraBody = { ...input.extraBody };
  return config;
}

// ---------- normalize --------------------------------------------------------

/**
 * Make Anthropic's field-rippling invariants true: when extended thinking is
 * active (`enabled` or `adaptive`), the API rejects `temperature` and `top_p`.
 * Idempotent.
 *
 * The single-field range invariant `budgetTokens >= 1024 && < maxTokens` is
 * intentionally NOT enforced here — see `validateForSubmit`.
 */
export function normalizeAnthropicConfig(
  config: AnthropicConfig
): AnthropicConfig {
  if (!isThinkingActive(config.thinking)) {
    return config;
  }
  if (config.temperature === undefined && config.topP === undefined) {
    return config;
  }
  const next: AnthropicConfig = { ...config };
  delete next.temperature;
  delete next.topP;
  return next;
}

// ---------- validateForSubmit -----------------------------------------------

/**
 * Read-only check for invariants that block save/run but should not silently
 * mutate canonical state. Currently: the budget/max-tokens pair.
 */
export function validateAnthropicConfigForSubmit(
  config: AnthropicConfig
): readonly string[] {
  const errors: string[] = [];
  if (config.thinking?.type === "enabled") {
    const budget = config.thinking.budgetTokens;
    if (budget < ANTHROPIC_MINIMUM_BUDGET_TOKENS) {
      errors.push(
        `Thinking budget must be at least ${ANTHROPIC_MINIMUM_BUDGET_TOKENS} (got ${budget})`
      );
    }
    if (budget >= config.maxTokens) {
      errors.push(
        `Thinking budget (${budget}) must be less than max tokens (${config.maxTokens})`
      );
    }
  }
  return errors;
}

// ---------- toPromptInput ----------------------------------------------------

function thinkingToInput(
  thinking: AnthropicThinking
): PromptAnthropicThinkingConfigInput {
  switch (thinking.type) {
    case "disabled":
      return { disabled: { disabled: true } };
    case "enabled":
      return {
        enabled: {
          budgetTokens: thinking.budgetTokens,
          display: thinking.display ?? null,
        },
      };
    case "adaptive":
      return {
        adaptive: { display: thinking.display ?? null },
      };
    default:
      return assertUnreachable(thinking);
  }
}

/**
 * Build Phoenix's GraphQL prompt invocation input from canonical config. The
 * serializer normalizes first and refuses to serialize if `validateForSubmit`
 * returns any errors. Undefined keys are omitted entirely so "unset" remains
 * distinguishable from an explicit provider value.
 *
 * Promoted fields (`responseFormat`, `toolChoice`) are NOT written here — they
 * live as top-level fields on `ChatPromptVersionInput` and the caller is
 * responsible for assembling them.
 */
export function anthropicConfigToPromptInput(
  config: AnthropicConfig
): PromptInvocationParametersInput {
  const normalized = normalizeAnthropicConfig(config);
  const errors = validateAnthropicConfigForSubmit(normalized);
  if (errors.length > 0) {
    throw new Error(
      `Cannot serialize Anthropic invocation parameters: ${errors.join("; ")}`
    );
  }
  const anthropic: PromptAnthropicInvocationParametersInput = {
    maxTokens: normalized.maxTokens,
  };
  if (normalized.temperature !== undefined)
    anthropic.temperature = normalized.temperature;
  if (normalized.topP !== undefined) anthropic.topP = normalized.topP;
  if (normalized.stopSequences !== undefined)
    anthropic.stopSequences = normalized.stopSequences;
  if (normalized.thinking !== undefined)
    anthropic.thinking = thinkingToInput(normalized.thinking);
  if (normalized.effort !== undefined)
    anthropic.outputConfig = { effort: normalized.effort };
  if (normalized.extraBody !== undefined)
    anthropic.extraBody = normalized.extraBody;
  return { anthropic };
}

// ---------- fromPromptInvocationParameters -----------------------------------

/**
 * Read Phoenix's GraphQL prompt invocation union into canonical config. Only
 * accepts the Anthropic branch; throws for other branches because the caller
 * should be dispatching on `__typename` before reaching this adapter.
 *
 * Normalizes the result so consumers can rely on field-rippling invariants
 * being satisfied.
 */
export function anthropicConfigFromPromptInvocationParameters(
  data: PromptInvocationParametersReadableFragment$data
): AnthropicConfig {
  if (data.__typename !== "PromptAnthropicInvocationParameters") {
    throw new Error(
      `anthropicAdapter.fromPromptInvocationParameters called with non-Anthropic typename: ${data.__typename}`
    );
  }
  const config: AnthropicConfig = {
    maxTokens: data.anthropicMaxTokens,
  };
  if (data.temperature != null) config.temperature = data.temperature;
  if (data.topP != null) config.topP = data.topP;
  if (data.stopSequences != null)
    config.stopSequences = [...data.stopSequences];
  if (data.outputConfig?.effort != null)
    config.effort = data.outputConfig.effort;
  if (data.thinking) {
    switch (data.thinking.__typename) {
      case "PromptAnthropicThinkingDisabled":
        config.thinking = { type: "disabled" };
        break;
      case "PromptAnthropicThinkingEnabled": {
        const enabled: AnthropicThinkingEnabled = {
          type: "enabled",
          budgetTokens: data.thinking.budgetTokens,
        };
        if (data.thinking.enabledDisplay != null)
          enabled.display = data.thinking.enabledDisplay;
        config.thinking = enabled;
        break;
      }
      case "PromptAnthropicThinkingAdaptive": {
        const adaptive: AnthropicThinkingAdaptive = { type: "adaptive" };
        if (data.thinking.adaptiveDisplay != null)
          adaptive.display = data.thinking.adaptiveDisplay;
        config.thinking = adaptive;
        break;
      }
      case "%other":
        // Forward-compat: a thinking variant added server-side this client
        // doesn't know — drop it rather than half-render.
        break;
      default:
        assertUnreachable(data.thinking);
    }
  }
  const extraBody = pickExtraBody(data.extraBody);
  if (extraBody != null) config.extraBody = extraBody;
  return normalizeAnthropicConfig(config);
}

export function anthropicConfigFromPromptInvocationParametersForDisplay(
  data: PromptInvocationParametersReadableFragment$data
): Record<string, unknown> {
  if (data.__typename !== "PromptAnthropicInvocationParameters") {
    throw new Error(
      `anthropicAdapter.fromPromptInvocationParametersForDisplay called with non-Anthropic typename: ${data.__typename}`
    );
  }
  const parameters: Record<string, unknown> = {
    maxTokens: data.anthropicMaxTokens,
  };
  if (data.temperature != null) parameters.temperature = data.temperature;
  if (data.topP != null) parameters.topP = data.topP;
  if (data.stopSequences != null)
    parameters.stopSequences = [...data.stopSequences];
  if (data.outputConfig?.effort != null)
    parameters.outputConfig = { effort: data.outputConfig.effort };
  if (data.thinking) {
    switch (data.thinking.__typename) {
      case "PromptAnthropicThinkingDisabled":
        parameters.thinking = { type: "disabled" };
        break;
      case "PromptAnthropicThinkingEnabled": {
        const enabled: AnthropicThinkingEnabled = {
          type: "enabled",
          budgetTokens: data.thinking.budgetTokens,
        };
        if (data.thinking.enabledDisplay != null)
          enabled.display = data.thinking.enabledDisplay;
        parameters.thinking = enabled;
        break;
      }
      case "PromptAnthropicThinkingAdaptive": {
        const adaptive: AnthropicThinkingAdaptive = { type: "adaptive" };
        if (data.thinking.adaptiveDisplay != null)
          adaptive.display = data.thinking.adaptiveDisplay;
        parameters.thinking = adaptive;
        break;
      }
      case "%other":
        break;
      default:
        assertUnreachable(data.thinking);
    }
  }
  const extraBody = pickExtraBody(data.extraBody);
  if (extraBody != null) parameters.extraBody = extraBody;
  return parameters;
}

// ---------- fromSpanInvocationParameters -------------------------------------

const spanOutputConfigSchema = z
  .looseObject({
    effort: effortSchema,
    format: z
      .object({
        type: z.literal("json_schema"),
        schema: z.record(z.string(), z.unknown()),
      })
      .optional()
      .catch(undefined),
  })
  .optional()
  .catch(undefined);

const spanConfigSchema = z.looseObject({
  max_tokens: z.number().optional().catch(undefined),
  temperature: z.number().optional().catch(undefined),
  top_p: z.number().optional().catch(undefined),
  stop_sequences: stopSequencesSchema,
  thinking: spanThinkingSchema,
  output_config: spanOutputConfigSchema,
  extra_body: extraBodySchema,
});

/**
 * Hydrate canonical config + promoted playground fields from a recorded
 * Anthropic span payload (`llm.invocation_parameters`).
 *
 * Order of operations: parse → split promoted (`output_config.format` →
 * `responseFormat`) → keep canonical invocation fields → normalize. The
 * `output_config` group is split inside this function, so `normalize` and
 * canonical state never have to know it was ever a compound thing.
 */
export function anthropicConfigFromSpanInvocationParameters(raw: unknown): {
  config: AnthropicConfig;
  promoted: PromotedPlaygroundFields;
} {
  const parsed = spanConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: AnthropicConfig = {
    maxTokens: input.max_tokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
  };
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.top_p !== undefined) config.topP = input.top_p;
  if (input.stop_sequences !== undefined)
    config.stopSequences = [...input.stop_sequences];
  const thinking = spanThinkingToCanonical(input.thinking);
  if (thinking !== undefined) config.thinking = thinking;
  if (input.output_config?.effort !== undefined)
    config.effort = input.output_config.effort;
  if (input.extra_body !== undefined) {
    const eb = pickExtraBody(input.extra_body);
    if (eb !== undefined) config.extraBody = eb;
  }
  const promoted: PromotedPlaygroundFields = {};
  const format = input.output_config?.format;
  if (format) {
    promoted.responseFormat = {
      type: "json_schema",
      jsonSchema: { name: "response", schema: format.schema },
    };
  }
  return { config: normalizeAnthropicConfig(config), promoted };
}

// ---------- field-keyed read/write ------------------------------------------

/**
 * Project a single user-facing leaf from the canonical config. Returns the
 * value the generic form widget expects — lowercased enum values, etc. —
 * or `undefined` when the leaf isn't reachable in the current config.
 */
export function anthropicReadField(
  config: AnthropicConfig,
  name: string
): unknown {
  switch (name) {
    case "maxTokens":
      return config.maxTokens;
    case "temperature":
      return config.temperature;
    case "topP":
      return config.topP;
    case "stopSequences":
      return config.stopSequences;
    case "thinkingType":
      return config.thinking?.type;
    case "thinkingBudgetTokens":
      return config.thinking?.type === "enabled"
        ? config.thinking.budgetTokens
        : undefined;
    case "thinkingDisplay":
      return config.thinking && config.thinking.type !== "disabled"
        ? config.thinking.display?.toLowerCase()
        : undefined;
    case "effort":
      return config.effort?.toLowerCase();
    case "extraBody":
      return config.extraBody;
    default:
      return undefined;
  }
}

/**
 * Apply a single user-facing leaf write to the canonical config. Cross-field
 * invariants (rebuilding the discriminated `thinking` union, stripping
 * temp/top_p when thinking is active) are enforced via `normalizeAnthropicConfig`
 * and per-case rebuild logic. Required leaves can be re-assigned but not
 * cleared; out-of-reach leaves are silently ignored.
 */
export function anthropicWriteField(
  config: AnthropicConfig,
  name: string,
  value: unknown
): AnthropicConfig {
  switch (name) {
    case "maxTokens": {
      if (typeof value !== "number" || Number.isNaN(value)) return config;
      return normalizeAnthropicConfig({ ...config, maxTokens: value });
    }
    case "temperature": {
      if (value === undefined) {
        const next = { ...config };
        delete next.temperature;
        return normalizeAnthropicConfig(next);
      }
      if (typeof value !== "number" || Number.isNaN(value)) return config;
      return normalizeAnthropicConfig({ ...config, temperature: value });
    }
    case "topP": {
      if (value === undefined) {
        const next = { ...config };
        delete next.topP;
        return normalizeAnthropicConfig(next);
      }
      if (typeof value !== "number" || Number.isNaN(value)) return config;
      return normalizeAnthropicConfig({ ...config, topP: value });
    }
    case "stopSequences": {
      if (value === undefined) {
        const next = { ...config };
        delete next.stopSequences;
        return normalizeAnthropicConfig(next);
      }
      if (!Array.isArray(value)) return config;
      return normalizeAnthropicConfig({
        ...config,
        stopSequences: value.map(String),
      });
    }
    case "thinkingType": {
      if (value === undefined) {
        const next = { ...config };
        delete next.thinking;
        return normalizeAnthropicConfig(next);
      }
      if (value === "disabled") {
        return normalizeAnthropicConfig({
          ...config,
          thinking: { type: "disabled" },
        });
      }
      if (value === "enabled") {
        const prev = config.thinking;
        const budgetTokens =
          prev?.type === "enabled"
            ? prev.budgetTokens
            : ANTHROPIC_MINIMUM_BUDGET_TOKENS;
        const display =
          prev && prev.type !== "disabled" ? prev.display : undefined;
        const enabled: AnthropicThinkingEnabled = {
          type: "enabled",
          budgetTokens,
        };
        if (display !== undefined) enabled.display = display;
        // Anthropic requires `budgetTokens < maxTokens`. If the existing
        // `maxTokens` would render an unsatisfiable budget range, bump it so
        // the form opens in a valid state instead of failing only at submit.
        const maxTokens =
          config.maxTokens > budgetTokens ? config.maxTokens : budgetTokens + 1;
        return normalizeAnthropicConfig({
          ...config,
          maxTokens,
          thinking: enabled,
        });
      }
      if (value === "adaptive") {
        const prev = config.thinking;
        const display =
          prev && prev.type !== "disabled" ? prev.display : undefined;
        const adaptive: AnthropicThinkingAdaptive = { type: "adaptive" };
        if (display !== undefined) adaptive.display = display;
        return normalizeAnthropicConfig({ ...config, thinking: adaptive });
      }
      return config;
    }
    case "thinkingBudgetTokens": {
      if (config.thinking?.type !== "enabled") return config;
      if (value === undefined) return config; // can't clear while enabled
      if (typeof value !== "number" || Number.isNaN(value)) return config;
      return normalizeAnthropicConfig({
        ...config,
        thinking: { ...config.thinking, budgetTokens: value },
      });
    }
    case "thinkingDisplay": {
      const prev = config.thinking;
      if (!prev || prev.type === "disabled") return config;
      if (value === undefined) {
        if (prev.type === "enabled") {
          const next: AnthropicThinkingEnabled = {
            type: "enabled",
            budgetTokens: prev.budgetTokens,
          };
          return normalizeAnthropicConfig({ ...config, thinking: next });
        }
        return normalizeAnthropicConfig({
          ...config,
          thinking: { type: "adaptive" },
        });
      }
      const parsed = thinkingDisplaySchema.safeParse(value);
      if (!parsed.success || !parsed.data) return config;
      if (prev.type === "enabled") {
        return normalizeAnthropicConfig({
          ...config,
          thinking: {
            type: "enabled",
            budgetTokens: prev.budgetTokens,
            display: parsed.data,
          },
        });
      }
      return normalizeAnthropicConfig({
        ...config,
        thinking: { type: "adaptive", display: parsed.data },
      });
    }
    case "effort": {
      if (value === undefined) {
        const next = { ...config };
        delete next.effort;
        return normalizeAnthropicConfig(next);
      }
      const parsed = effortSchema.safeParse(value);
      if (!parsed.success || !parsed.data) return config;
      return normalizeAnthropicConfig({ ...config, effort: parsed.data });
    }
    case "extraBody": {
      if (value === undefined) {
        const next = { ...config };
        delete next.extraBody;
        return normalizeAnthropicConfig(next);
      }
      const extraBody = pickExtraBody(value);
      if (extraBody === undefined) return config;
      return normalizeAnthropicConfig({ ...config, extraBody });
    }
    default:
      return config;
  }
}

// ---------- adapter object ---------------------------------------------------

function pickExtraBody(value: unknown): Record<string, unknown> | undefined {
  if (isPlainObject(value)) {
    return value;
  }
  return undefined;
}

export const anthropicAdapter: ProviderInvocationAdapter<AnthropicConfig> = {
  getDefaultConfig: getDefaultAnthropicConfig,
  getVisibleSpecs: getVisibleAnthropicSpecs,
  parseConfig: parseAnthropicConfig,
  normalize: normalizeAnthropicConfig,
  validateForSubmit: validateAnthropicConfigForSubmit,
  toPromptInput: anthropicConfigToPromptInput,
  fromPromptInvocationParameters: anthropicConfigFromPromptInvocationParameters,
  fromPromptInvocationParametersForDisplay:
    anthropicConfigFromPromptInvocationParametersForDisplay,
  fromSpanInvocationParameters: anthropicConfigFromSpanInvocationParameters,
  readField: anthropicReadField,
  writeField: anthropicWriteField,
};
