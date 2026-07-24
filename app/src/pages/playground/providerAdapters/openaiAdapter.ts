/**
 * OpenAI provider invocation adapter (covers OpenAI, Azure OpenAI, and the
 * OpenAI-compatible providers — DeepSeek, xAI, Ollama, Cerebras, Fireworks,
 * Groq, Moonshot, Perplexity, Together).
 *
 * Owns: the alternate-key fold (`maxTokens` → `maxCompletionTokens`,
 * `max_output_tokens` → `maxCompletionTokens`, `reasoning.effort` →
 * `reasoningEffort`), the zero-value serialization filter for
 * `frequencyPenalty` / `presencePenalty`, and the `applicableOpenAIApiTypes`
 * mode-aware visibility for the generic parameter form.
 */

import { z } from "zod";

import { DEFAULT_OPENAI_API_TYPE } from "@phoenix/constants/generativeConstants";
import {
  parseOpenAIReasoningEffort,
  toOpenAIReasoningEffortFormValue,
} from "@phoenix/pages/playground/invocationParameterEnumOptions";
import type { CanonicalResponseFormat } from "@phoenix/store/playground/types";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import type {
  PromptInvocationParametersInput,
  PromptOpenAIInvocationParametersInput,
} from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { OPENAI_INVOCATION_PARAMETERS } from "../invocationParameterSpecs";
import type {
  ProviderFormSpecContext,
  ProviderInvocationAdapter,
} from "./types";

// ---------- canonical types --------------------------------------------------

/**
 * Canonical OpenAI invocation config. `reasoningEffort` is stored as the
 * lowercase form value (`"high"`, `"low"`, …) to match the existing
 * `OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM` mapping; the GraphQL enum
 * casing is restored at the serialization boundary.
 *
 * `apiType` is NOT part of the config — it is a model-level setting
 * (Chat Completions vs Responses) and is passed to the adapter methods that
 * depend on it.
 */
export type OpenAIConfig = {
  temperature?: number;
  topP?: number;
  maxCompletionTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: string;
  seed?: number;
  stop?: string[];
  extraBody?: Record<string, unknown>;
};

export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";

export type OpenAIPromotedPlaygroundFields = {
  responseFormat?: CanonicalResponseFormat;
};

// ---------- helpers ----------------------------------------------------------

function pickExtraBody(value: unknown): Record<string, unknown> | undefined {
  if (isPlainObject(value)) {
    return value;
  }
  return undefined;
}

/**
 * For `frequencyPenalty` and `presencePenalty`, OpenAI treats `0` and absent
 * as operationally equivalent. The filter lives at the serialization boundary
 * for the same reason `budgetTokens` clamping does not live in `normalize` for
 * Anthropic: dropping a user-typed `0` from canonical state would silently
 * mutate user input. Keeping the filter at serialization preserves the user's
 * intent in canonical state.
 */
function dropZeroPenalty(value: number | undefined): number | undefined {
  return value === 0 ? undefined : value;
}

// ---------- parseConfig ------------------------------------------------------

export function getDefaultOpenAIConfig(): OpenAIConfig {
  return {
    frequencyPenalty: 0,
    presencePenalty: 0,
  };
}

export function getVisibleOpenAISpecs(
  _config: OpenAIConfig | undefined,
  context: ProviderFormSpecContext
) {
  const apiType = context.openaiApiType ?? DEFAULT_OPENAI_API_TYPE;
  return OPENAI_INVOCATION_PARAMETERS.filter((spec) => {
    const applicableApiTypes =
      "applicableOpenAIApiTypes" in spec
        ? spec.applicableOpenAIApiTypes
        : undefined;
    if (applicableApiTypes == null) {
      return true;
    }
    return (applicableApiTypes as readonly OpenAIApiType[]).includes(apiType);
  });
}

const canonicalConfigSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  topP: z.number().optional().catch(undefined),
  maxCompletionTokens: z.number().optional().catch(undefined),
  frequencyPenalty: z.number().optional().catch(undefined),
  presencePenalty: z.number().optional().catch(undefined),
  reasoningEffort: z.string().optional().catch(undefined),
  seed: z.number().optional().catch(undefined),
  stop: z.array(z.string()).optional().catch(undefined),
  extraBody: z.record(z.string(), z.unknown()).optional().catch(undefined),
});

export function parseOpenAIConfig(raw: unknown): OpenAIConfig {
  const parsed = canonicalConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: OpenAIConfig = {};
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.topP !== undefined) config.topP = input.topP;
  if (input.maxCompletionTokens !== undefined)
    config.maxCompletionTokens = input.maxCompletionTokens;
  if (input.frequencyPenalty !== undefined)
    config.frequencyPenalty = input.frequencyPenalty;
  if (input.presencePenalty !== undefined)
    config.presencePenalty = input.presencePenalty;
  if (input.reasoningEffort !== undefined) {
    const form = toOpenAIReasoningEffortFormValue(input.reasoningEffort);
    if (form !== undefined) config.reasoningEffort = form;
  }
  if (input.seed !== undefined) config.seed = input.seed;
  if (input.stop !== undefined) config.stop = [...input.stop];
  if (input.extraBody !== undefined) config.extraBody = { ...input.extraBody };
  return config;
}

// ---------- normalize --------------------------------------------------------

/**
 * Identity — OpenAI has no field-rippling invariants that need cross-field
 * repair. The API-type-driven field visibility is handled at the UI
 * descriptor layer, not here.
 */
export function normalizeOpenAIConfig(config: OpenAIConfig): OpenAIConfig {
  return config;
}

// ---------- validateForSubmit -----------------------------------------------

export function validateOpenAIConfigForSubmit(
  _config: OpenAIConfig
): readonly string[] {
  return [];
}

// ---------- toPromptInput ----------------------------------------------------

export function openAIConfigToPromptInput(
  config: OpenAIConfig
): PromptInvocationParametersInput {
  const normalized = normalizeOpenAIConfig(config);
  const openai: PromptOpenAIInvocationParametersInput = {};
  if (normalized.temperature !== undefined)
    openai.temperature = normalized.temperature;
  if (normalized.topP !== undefined) openai.topP = normalized.topP;
  if (normalized.maxCompletionTokens !== undefined)
    openai.maxCompletionTokens = normalized.maxCompletionTokens;
  const fp = dropZeroPenalty(normalized.frequencyPenalty);
  if (fp !== undefined) openai.frequencyPenalty = fp;
  const pp = dropZeroPenalty(normalized.presencePenalty);
  if (pp !== undefined) openai.presencePenalty = pp;
  if (normalized.reasoningEffort !== undefined) {
    const enumValue = parseOpenAIReasoningEffort(normalized.reasoningEffort);
    if (enumValue !== undefined) openai.reasoningEffort = enumValue;
  }
  if (normalized.seed !== undefined) openai.seed = normalized.seed;
  if (normalized.stop !== undefined) openai.stop = normalized.stop;
  if (normalized.extraBody !== undefined)
    openai.extraBody = normalized.extraBody;
  return { openai };
}

// ---------- fromPromptInvocationParameters -----------------------------------

export function openAIConfigFromPromptInvocationParameters(
  data: PromptInvocationParametersReadableFragment$data
): OpenAIConfig {
  if (data.__typename !== "PromptOpenAIInvocationParameters") {
    throw new Error(
      `openaiAdapter.fromPromptInvocationParameters called with non-OpenAI typename: ${data.__typename}`
    );
  }
  const config: OpenAIConfig = {};
  if (data.temperature != null) config.temperature = data.temperature;
  if (data.topP != null) config.topP = data.topP;
  if (data.maxCompletionTokens != null)
    config.maxCompletionTokens = data.maxCompletionTokens;
  else if (data.openaiMaxTokens != null)
    config.maxCompletionTokens = data.openaiMaxTokens;
  if (data.frequencyPenalty != null)
    config.frequencyPenalty = data.frequencyPenalty;
  if (data.presencePenalty != null)
    config.presencePenalty = data.presencePenalty;
  if (data.seed != null) config.seed = data.seed;
  if (data.stop != null) config.stop = [...data.stop];
  if (data.reasoningEffort != null) {
    const form = toOpenAIReasoningEffortFormValue(data.reasoningEffort);
    if (form !== undefined) config.reasoningEffort = form;
  }
  const extraBody = pickExtraBody(data.extraBody);
  if (extraBody != null) config.extraBody = extraBody;
  return normalizeOpenAIConfig(config);
}

export function openAIConfigFromPromptInvocationParametersForDisplay(
  data: PromptInvocationParametersReadableFragment$data
): Record<string, unknown> {
  if (data.__typename !== "PromptOpenAIInvocationParameters") {
    throw new Error(
      `openaiAdapter.fromPromptInvocationParametersForDisplay called with non-OpenAI typename: ${data.__typename}`
    );
  }
  const parameters: Record<string, unknown> = {};
  if (data.temperature != null) parameters.temperature = data.temperature;
  if (data.openaiMaxTokens != null) parameters.maxTokens = data.openaiMaxTokens;
  if (data.maxCompletionTokens != null)
    parameters.maxCompletionTokens = data.maxCompletionTokens;
  if (data.frequencyPenalty != null)
    parameters.frequencyPenalty = data.frequencyPenalty;
  if (data.presencePenalty != null)
    parameters.presencePenalty = data.presencePenalty;
  if (data.topP != null) parameters.topP = data.topP;
  if (data.seed != null) parameters.seed = data.seed;
  if (data.stop != null) parameters.stop = [...data.stop];
  const reasoningEffortFormValue = toOpenAIReasoningEffortFormValue(
    data.reasoningEffort
  );
  if (reasoningEffortFormValue !== undefined)
    parameters.reasoningEffort = reasoningEffortFormValue;
  const extraBody = pickExtraBody(data.extraBody);
  if (extraBody != null) parameters.extraBody = extraBody;
  return parameters;
}

// ---------- fromSpanInvocationParameters -------------------------------------

const responseFormatJsonSchemaSchema = z.object({
  name: z.string().optional(),
  schema: z.unknown().optional(),
  strict: z.boolean().nullish(),
  description: z.string().nullish(),
});

const chatResponseFormatSchema = z
  .object({
    type: z.string().optional(),
    json_schema: responseFormatJsonSchemaSchema.optional(),
  })
  .optional()
  .catch(undefined);

const responsesTextFormatSchema = z
  .object({
    type: z.string().optional(),
    name: z.string().optional(),
    schema: z.unknown().optional(),
    strict: z.boolean().optional(),
    description: z.string().optional(),
  })
  .optional()
  .catch(undefined);

const spanConfigSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  top_p: z.number().optional().catch(undefined),
  max_completion_tokens: z.number().optional().catch(undefined),
  max_tokens: z.number().optional().catch(undefined),
  max_output_tokens: z.number().optional().catch(undefined),
  frequency_penalty: z.number().optional().catch(undefined),
  presence_penalty: z.number().optional().catch(undefined),
  seed: z.number().optional().catch(undefined),
  stop: z.array(z.string()).optional().catch(undefined),
  reasoning_effort: z.string().optional().catch(undefined),
  reasoning: z
    .looseObject({ effort: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined),
  response_format: chatResponseFormatSchema,
  text: z
    .object({ format: responsesTextFormatSchema })
    .optional()
    .catch(undefined),
  extra_body: z.record(z.string(), z.unknown()).optional().catch(undefined),
});

/**
 * Hydrate canonical OpenAI config + promoted playground fields from a
 * recorded span payload. The `apiType` argument selects which alternate-key
 * fold to apply (`max_output_tokens` and nested `reasoning.effort` are
 * Responses-only).
 */
export function openAIConfigFromSpanInvocationParameters(
  raw: unknown,
  apiType: OpenAIApiType | null
): {
  config: OpenAIConfig;
  promoted: OpenAIPromotedPlaygroundFields;
} {
  const parsed = spanConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: OpenAIConfig = {};
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.top_p !== undefined) config.topP = input.top_p;
  if (input.max_completion_tokens !== undefined)
    config.maxCompletionTokens = input.max_completion_tokens;
  else if (input.max_tokens !== undefined)
    config.maxCompletionTokens = input.max_tokens;
  else if (apiType === "RESPONSES" && input.max_output_tokens !== undefined)
    config.maxCompletionTokens = input.max_output_tokens;
  if (input.frequency_penalty !== undefined)
    config.frequencyPenalty = input.frequency_penalty;
  if (input.presence_penalty !== undefined)
    config.presencePenalty = input.presence_penalty;
  if (input.seed !== undefined) config.seed = input.seed;
  if (input.stop !== undefined) config.stop = [...input.stop];
  let reasoningEffortRaw: string | undefined;
  if (input.reasoning_effort !== undefined)
    reasoningEffortRaw = input.reasoning_effort;
  else if (apiType === "RESPONSES" && input.reasoning?.effort !== undefined)
    reasoningEffortRaw = input.reasoning.effort;
  if (reasoningEffortRaw !== undefined) {
    const form = toOpenAIReasoningEffortFormValue(reasoningEffortRaw);
    if (form !== undefined) config.reasoningEffort = form;
  }
  if (input.extra_body !== undefined)
    config.extraBody = { ...input.extra_body };

  const promoted: OpenAIPromotedPlaygroundFields = {};
  // Try both response-format shapes because recorded spans are not always
  // tagged with which OpenAI API produced them.
  const rf = input.response_format;
  if (rf?.json_schema) {
    const js = rf.json_schema;
    const jsonSchema: CanonicalResponseFormat["jsonSchema"] = {
      name: typeof js.name === "string" ? js.name : "response",
    };
    if (js.schema !== undefined) jsonSchema.schema = js.schema;
    if (js.strict !== undefined && js.strict !== null)
      jsonSchema.strict = js.strict;
    if (js.description !== undefined && js.description !== null)
      jsonSchema.description = js.description;
    promoted.responseFormat = { type: "json_schema", jsonSchema };
  } else if (input.text?.format !== undefined) {
    const fmt = input.text.format;
    if (fmt) {
      const jsonSchema: CanonicalResponseFormat["jsonSchema"] = {
        name: typeof fmt.name === "string" ? fmt.name : "response",
      };
      if (fmt.schema !== undefined) jsonSchema.schema = fmt.schema;
      if (fmt.strict !== undefined) jsonSchema.strict = fmt.strict;
      if (fmt.description !== undefined)
        jsonSchema.description = fmt.description;
      promoted.responseFormat = { type: "json_schema", jsonSchema };
    }
  }
  return { config: normalizeOpenAIConfig(config), promoted };
}

// ---------- field-keyed read/write ------------------------------------------

const OPENAI_NUMBER_FIELDS = [
  "temperature",
  "topP",
  "maxCompletionTokens",
  "frequencyPenalty",
  "presencePenalty",
  "seed",
] as const;
type OpenAINumberField = (typeof OPENAI_NUMBER_FIELDS)[number];

const OPENAI_NUMBER_FIELD_SET: ReadonlySet<string> = new Set(
  OPENAI_NUMBER_FIELDS
);

function isOpenAINumberField(name: string): name is OpenAINumberField {
  return OPENAI_NUMBER_FIELD_SET.has(name);
}

export function openAIReadField(config: OpenAIConfig, name: string): unknown {
  if (isOpenAINumberField(name)) return config[name];
  switch (name) {
    case "reasoningEffort":
      return config.reasoningEffort;
    case "stop":
      return config.stop;
    case "extraBody":
      return config.extraBody;
    default:
      return undefined;
  }
}

export function openAIWriteField(
  config: OpenAIConfig,
  name: string,
  value: unknown
): OpenAIConfig {
  if (isOpenAINumberField(name)) {
    if (value === undefined) {
      const next = { ...config };
      delete next[name];
      return normalizeOpenAIConfig(next);
    }
    if (typeof value !== "number" || Number.isNaN(value)) return config;
    return normalizeOpenAIConfig({ ...config, [name]: value });
  }
  switch (name) {
    case "reasoningEffort": {
      if (value === undefined) {
        const next = { ...config };
        delete next.reasoningEffort;
        return normalizeOpenAIConfig(next);
      }
      if (typeof value !== "string") return config;
      return normalizeOpenAIConfig({ ...config, reasoningEffort: value });
    }
    case "stop": {
      if (value === undefined) {
        const next = { ...config };
        delete next.stop;
        return normalizeOpenAIConfig(next);
      }
      if (!Array.isArray(value)) return config;
      return normalizeOpenAIConfig({ ...config, stop: value.map(String) });
    }
    case "extraBody": {
      if (value === undefined) {
        const next = { ...config };
        delete next.extraBody;
        return normalizeOpenAIConfig(next);
      }
      const extraBody = pickExtraBody(value);
      if (extraBody === undefined) return config;
      return normalizeOpenAIConfig({ ...config, extraBody });
    }
    default:
      return config;
  }
}

export const openAIAdapter: ProviderInvocationAdapter<OpenAIConfig> = {
  getDefaultConfig: getDefaultOpenAIConfig,
  getVisibleSpecs: getVisibleOpenAISpecs,
  parseConfig: parseOpenAIConfig,
  normalize: normalizeOpenAIConfig,
  validateForSubmit: validateOpenAIConfigForSubmit,
  toPromptInput: openAIConfigToPromptInput,
  fromPromptInvocationParameters: openAIConfigFromPromptInvocationParameters,
  fromPromptInvocationParametersForDisplay:
    openAIConfigFromPromptInvocationParametersForDisplay,
  fromSpanInvocationParameters: (raw, options) =>
    openAIConfigFromSpanInvocationParameters(
      raw,
      options?.openaiApiType ?? null
    ),
  readField: openAIReadField,
  writeField: openAIWriteField,
};
