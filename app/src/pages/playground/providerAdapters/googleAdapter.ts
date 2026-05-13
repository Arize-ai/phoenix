/**
 * Google (Gemini) provider invocation adapter.
 *
 * Google does not have mode-shaped invocation invariants like Anthropic
 * thinking, but it still has provider-specific defaults, enum casing, prompt
 * translation, and span response-format promotion
 * (`response_json_schema` / `response_schema` + `response_mime_type` →
 * canonical `responseFormat`).
 */

import { z } from "zod";

import type { CanonicalResponseFormat } from "@phoenix/store/playground/types";

import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import type {
  GoogleThinkingLevel,
  PromptGoogleInvocationParametersInput,
  PromptGoogleThinkingConfigInput,
  PromptInvocationParametersInput,
} from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { GOOGLE_THINKING_LEVEL_VALUES } from "../invocationParameterEnumOptions";
import { GOOGLE_INVOCATION_PARAMETERS } from "../invocationParameterSpecs";
import type { ProviderInvocationAdapter } from "./types";

// ---------- canonical types --------------------------------------------------

export type GoogleThinkingConfig = {
  thinkingBudget?: number;
  thinkingLevel?: GoogleThinkingLevel;
  includeThoughts?: boolean;
};

export type GoogleConfig = {
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  topP?: number;
  topK?: number;
  thinkingConfig?: GoogleThinkingConfig;
};

export type GooglePromotedPlaygroundFields = {
  responseFormat?: CanonicalResponseFormat;
};

// ---------- parseConfig ------------------------------------------------------

export function getDefaultGoogleConfig(): GoogleConfig {
  return {
    temperature: 1,
    presencePenalty: 0,
    frequencyPenalty: 0,
    thinkingConfig: {
      thinkingLevel: "MEDIUM",
      includeThoughts: true,
    },
  };
}

export function getVisibleGoogleSpecs() {
  return GOOGLE_INVOCATION_PARAMETERS;
}

const thinkingLevelSchema = z
  .string()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(GOOGLE_THINKING_LEVEL_VALUES))
  .optional()
  .catch(undefined);

const canonicalThinkingConfigSchema = z
  .looseObject({
    thinkingBudget: z.number().optional().catch(undefined),
    thinkingLevel: thinkingLevelSchema,
    includeThoughts: z.boolean().optional().catch(undefined),
  })
  .optional()
  .catch(undefined);

const canonicalConfigSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  maxOutputTokens: z.number().optional().catch(undefined),
  stopSequences: z.array(z.string()).optional().catch(undefined),
  presencePenalty: z.number().optional().catch(undefined),
  frequencyPenalty: z.number().optional().catch(undefined),
  topP: z.number().optional().catch(undefined),
  topK: z.number().optional().catch(undefined),
  thinkingConfig: canonicalThinkingConfigSchema,
});

export function parseGoogleConfig(raw: unknown): GoogleConfig {
  const parsed = canonicalConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: GoogleConfig = {};
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.maxOutputTokens !== undefined)
    config.maxOutputTokens = input.maxOutputTokens;
  if (input.stopSequences !== undefined)
    config.stopSequences = [...input.stopSequences];
  if (input.presencePenalty !== undefined)
    config.presencePenalty = input.presencePenalty;
  if (input.frequencyPenalty !== undefined)
    config.frequencyPenalty = input.frequencyPenalty;
  if (input.topP !== undefined) config.topP = input.topP;
  if (input.topK !== undefined) config.topK = input.topK;
  if (input.thinkingConfig !== undefined && input.thinkingConfig !== null) {
    config.thinkingConfig = sanitizeThinkingConfig(input.thinkingConfig);
  }
  return config;
}

function sanitizeThinkingConfig(
  tc: GoogleThinkingConfig
): GoogleThinkingConfig {
  const out: GoogleThinkingConfig = {};
  if (tc.thinkingBudget !== undefined) out.thinkingBudget = tc.thinkingBudget;
  if (tc.thinkingLevel !== undefined) out.thinkingLevel = tc.thinkingLevel;
  if (tc.includeThoughts !== undefined)
    out.includeThoughts = tc.includeThoughts;
  return out;
}

// ---------- normalize --------------------------------------------------------

export function normalizeGoogleConfig(config: GoogleConfig): GoogleConfig {
  return config;
}

// ---------- validateForSubmit -----------------------------------------------

export function validateGoogleConfigForSubmit(
  _config: GoogleConfig
): readonly string[] {
  return [];
}

// ---------- toPromptInput ----------------------------------------------------

function thinkingConfigToInput(
  tc: GoogleThinkingConfig
): PromptGoogleThinkingConfigInput | undefined {
  const out: PromptGoogleThinkingConfigInput = {};
  if (tc.thinkingBudget !== undefined) out.thinkingBudget = tc.thinkingBudget;
  if (tc.thinkingLevel !== undefined) out.thinkingLevel = tc.thinkingLevel;
  if (tc.includeThoughts !== undefined)
    out.includeThoughts = tc.includeThoughts;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function googleConfigToPromptInput(
  config: GoogleConfig
): PromptInvocationParametersInput {
  const normalized = normalizeGoogleConfig(config);
  const google: PromptGoogleInvocationParametersInput = {};
  if (normalized.temperature !== undefined)
    google.temperature = normalized.temperature;
  if (normalized.maxOutputTokens !== undefined)
    google.maxOutputTokens = normalized.maxOutputTokens;
  if (normalized.stopSequences !== undefined)
    google.stopSequences = normalized.stopSequences;
  if (normalized.presencePenalty !== undefined)
    google.presencePenalty = normalized.presencePenalty;
  if (normalized.frequencyPenalty !== undefined)
    google.frequencyPenalty = normalized.frequencyPenalty;
  if (normalized.topP !== undefined) google.topP = normalized.topP;
  if (normalized.topK !== undefined) google.topK = normalized.topK;
  if (normalized.thinkingConfig !== undefined) {
    const tc = thinkingConfigToInput(normalized.thinkingConfig);
    if (tc) google.thinkingConfig = tc;
  }
  return { google };
}

// ---------- fromPromptInvocationParameters -----------------------------------

export function googleConfigFromPromptInvocationParameters(
  data: PromptInvocationParametersReadableFragment$data
): GoogleConfig {
  if (data.__typename !== "PromptGoogleInvocationParameters") {
    throw new Error(
      `googleAdapter.fromPromptInvocationParameters called with non-Google typename: ${data.__typename}`
    );
  }
  const config: GoogleConfig = {};
  if (data.temperature != null) config.temperature = data.temperature;
  if (data.maxOutputTokens != null)
    config.maxOutputTokens = data.maxOutputTokens;
  if (data.stopSequences != null)
    config.stopSequences = [...data.stopSequences];
  if (data.presencePenalty != null)
    config.presencePenalty = data.presencePenalty;
  if (data.frequencyPenalty != null)
    config.frequencyPenalty = data.frequencyPenalty;
  if (data.topP != null) config.topP = data.topP;
  if (data.topK != null) config.topK = data.topK;
  if (data.thinkingConfig) {
    const tc: GoogleThinkingConfig = {};
    if (data.thinkingConfig.thinkingBudget != null)
      tc.thinkingBudget = data.thinkingConfig.thinkingBudget;
    if (data.thinkingConfig.thinkingLevel != null)
      tc.thinkingLevel = data.thinkingConfig.thinkingLevel;
    if (data.thinkingConfig.includeThoughts != null)
      tc.includeThoughts = data.thinkingConfig.includeThoughts;
    if (Object.keys(tc).length > 0) config.thinkingConfig = tc;
  }
  return normalizeGoogleConfig(config);
}

export function googleConfigFromPromptInvocationParametersForDisplay(
  data: PromptInvocationParametersReadableFragment$data
): Record<string, unknown> {
  if (data.__typename !== "PromptGoogleInvocationParameters") {
    throw new Error(
      `googleAdapter.fromPromptInvocationParametersForDisplay called with non-Google typename: ${data.__typename}`
    );
  }
  const parameters: Record<string, unknown> = {};
  if (data.temperature != null) parameters.temperature = data.temperature;
  if (data.maxOutputTokens != null)
    parameters.maxOutputTokens = data.maxOutputTokens;
  if (data.stopSequences != null)
    parameters.stopSequences = [...data.stopSequences];
  if (data.presencePenalty != null)
    parameters.presencePenalty = data.presencePenalty;
  if (data.frequencyPenalty != null)
    parameters.frequencyPenalty = data.frequencyPenalty;
  if (data.topP != null) parameters.topP = data.topP;
  if (data.topK != null) parameters.topK = data.topK;
  if (data.thinkingConfig) {
    const thinkingConfig: GoogleThinkingConfig = {};
    if (data.thinkingConfig.thinkingBudget != null)
      thinkingConfig.thinkingBudget = data.thinkingConfig.thinkingBudget;
    if (data.thinkingConfig.thinkingLevel != null)
      thinkingConfig.thinkingLevel = data.thinkingConfig.thinkingLevel;
    if (data.thinkingConfig.includeThoughts != null)
      thinkingConfig.includeThoughts = data.thinkingConfig.includeThoughts;
    if (Object.keys(thinkingConfig).length > 0)
      parameters.thinkingConfig = thinkingConfig;
  }
  return parameters;
}

// ---------- fromSpanInvocationParameters -------------------------------------

const spanThinkingConfigSchema = z
  .looseObject({
    thinking_budget: z.number().optional().catch(undefined),
    thinking_level: thinkingLevelSchema,
    include_thoughts: z.boolean().optional().catch(undefined),
  })
  .optional()
  .catch(undefined);

const spanConfigSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  max_output_tokens: z.number().optional().catch(undefined),
  stop_sequences: z.array(z.string()).optional().catch(undefined),
  presence_penalty: z.number().optional().catch(undefined),
  frequency_penalty: z.number().optional().catch(undefined),
  top_p: z.number().optional().catch(undefined),
  top_k: z.number().optional().catch(undefined),
  thinking_config: spanThinkingConfigSchema,
  response_json_schema: z.unknown().optional(),
  response_schema: z.unknown().optional(),
  response_mime_type: z.string().optional().catch(undefined),
});

export function googleConfigFromSpanInvocationParameters(raw: unknown): {
  config: GoogleConfig;
  promoted: GooglePromotedPlaygroundFields;
} {
  const parsed = spanConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: GoogleConfig = {};
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.max_output_tokens !== undefined)
    config.maxOutputTokens = input.max_output_tokens;
  if (input.stop_sequences !== undefined)
    config.stopSequences = [...input.stop_sequences];
  if (input.presence_penalty !== undefined)
    config.presencePenalty = input.presence_penalty;
  if (input.frequency_penalty !== undefined)
    config.frequencyPenalty = input.frequency_penalty;
  if (input.top_p !== undefined) config.topP = input.top_p;
  if (input.top_k !== undefined) config.topK = input.top_k;
  if (input.thinking_config) {
    const tc: GoogleThinkingConfig = {};
    if (input.thinking_config.thinking_budget !== undefined)
      tc.thinkingBudget = input.thinking_config.thinking_budget;
    if (input.thinking_config.thinking_level !== undefined)
      tc.thinkingLevel = input.thinking_config.thinking_level;
    if (input.thinking_config.include_thoughts !== undefined)
      tc.includeThoughts = input.thinking_config.include_thoughts;
    if (Object.keys(tc).length > 0) config.thinkingConfig = tc;
  }

  const promoted: GooglePromotedPlaygroundFields = {};
  const schema = input.response_json_schema ?? input.response_schema;
  if (schema != null && input.response_mime_type === "application/json") {
    promoted.responseFormat = {
      type: "json_schema",
      jsonSchema: { name: "response", schema },
    };
  }

  return { config: normalizeGoogleConfig(config), promoted };
}

// ---------- field-keyed read/write ------------------------------------------

const GOOGLE_NUMBER_FIELDS = [
  "temperature",
  "maxOutputTokens",
  "presencePenalty",
  "frequencyPenalty",
  "topP",
  "topK",
] as const;
type GoogleNumberField = (typeof GOOGLE_NUMBER_FIELDS)[number];

const GOOGLE_NUMBER_FIELD_SET: ReadonlySet<string> = new Set(
  GOOGLE_NUMBER_FIELDS
);

function isGoogleNumberField(name: string): name is GoogleNumberField {
  return GOOGLE_NUMBER_FIELD_SET.has(name);
}

function compactThinkingConfig(
  tc: GoogleThinkingConfig
): GoogleThinkingConfig | undefined {
  const next: GoogleThinkingConfig = {};
  if (tc.thinkingBudget !== undefined) next.thinkingBudget = tc.thinkingBudget;
  if (tc.thinkingLevel !== undefined) next.thinkingLevel = tc.thinkingLevel;
  if (tc.includeThoughts !== undefined)
    next.includeThoughts = tc.includeThoughts;
  return Object.keys(next).length === 0 ? undefined : next;
}

export function googleReadField(config: GoogleConfig, name: string): unknown {
  if (isGoogleNumberField(name)) return config[name];
  switch (name) {
    case "stopSequences":
      return config.stopSequences;
    case "thinkingBudget":
      return config.thinkingConfig?.thinkingBudget;
    case "thinkingLevel":
      return config.thinkingConfig?.thinkingLevel?.toLowerCase();
    case "includeThoughts":
      return config.thinkingConfig?.includeThoughts;
    default:
      return undefined;
  }
}

export function googleWriteField(
  config: GoogleConfig,
  name: string,
  value: unknown
): GoogleConfig {
  if (isGoogleNumberField(name)) {
    if (value === undefined) {
      const next = { ...config };
      delete next[name];
      return normalizeGoogleConfig(next);
    }
    if (typeof value !== "number" || Number.isNaN(value)) return config;
    return normalizeGoogleConfig({ ...config, [name]: value });
  }
  switch (name) {
    case "stopSequences": {
      if (value === undefined) {
        const next = { ...config };
        delete next.stopSequences;
        return normalizeGoogleConfig(next);
      }
      if (!Array.isArray(value)) return config;
      return normalizeGoogleConfig({
        ...config,
        stopSequences: value.map(String),
      });
    }
    case "thinkingBudget": {
      const prev = config.thinkingConfig ?? {};
      const nextTc: GoogleThinkingConfig = { ...prev };
      if (value === undefined) delete nextTc.thinkingBudget;
      else if (typeof value === "number" && !Number.isNaN(value))
        nextTc.thinkingBudget = value;
      else return config;
      return applyThinkingConfig(config, nextTc);
    }
    case "thinkingLevel": {
      const prev = config.thinkingConfig ?? {};
      const nextTc: GoogleThinkingConfig = { ...prev };
      if (value === undefined) delete nextTc.thinkingLevel;
      else {
        const parsed = thinkingLevelSchema.safeParse(value);
        if (!parsed.success || !parsed.data) return config;
        nextTc.thinkingLevel = parsed.data;
      }
      return applyThinkingConfig(config, nextTc);
    }
    case "includeThoughts": {
      const prev = config.thinkingConfig ?? {};
      const nextTc: GoogleThinkingConfig = { ...prev };
      if (value === undefined) delete nextTc.includeThoughts;
      else if (typeof value === "boolean") nextTc.includeThoughts = value;
      else return config;
      return applyThinkingConfig(config, nextTc);
    }
    default:
      return config;
  }
}

function applyThinkingConfig(
  config: GoogleConfig,
  nextTc: GoogleThinkingConfig
): GoogleConfig {
  const compact = compactThinkingConfig(nextTc);
  const next = { ...config };
  if (compact === undefined) delete next.thinkingConfig;
  else next.thinkingConfig = compact;
  return normalizeGoogleConfig(next);
}

export const googleAdapter: ProviderInvocationAdapter<GoogleConfig> = {
  getDefaultConfig: getDefaultGoogleConfig,
  getVisibleSpecs: getVisibleGoogleSpecs,
  parseConfig: parseGoogleConfig,
  normalize: normalizeGoogleConfig,
  validateForSubmit: validateGoogleConfigForSubmit,
  toPromptInput: googleConfigToPromptInput,
  fromPromptInvocationParameters: googleConfigFromPromptInvocationParameters,
  fromPromptInvocationParametersForDisplay:
    googleConfigFromPromptInvocationParametersForDisplay,
  fromSpanInvocationParameters: (raw) =>
    googleConfigFromSpanInvocationParameters(raw),
  readField: googleReadField,
  writeField: googleWriteField,
};
