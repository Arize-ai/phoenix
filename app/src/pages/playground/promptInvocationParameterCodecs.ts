import { z } from "zod";

import type { PromptInvocationParametersReadableFragment$data } from "@phoenix/pages/playground/__generated__/PromptInvocationParametersReadableFragment.graphql";
import type {
  AnthropicOutputConfigEffort,
  AnthropicThinkingDisplay,
  ChatPromptVersionInput,
  GoogleThinkingLevel,
  PromptAnthropicThinkingConfigInput,
  PromptGoogleThinkingConfigInput,
} from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { InvocationFamily } from "@phoenix/pages/playground/invocationParameterSpecs";
import {
  parseOpenAIReasoningEffort,
  toOpenAIReasoningEffortFormValue,
} from "@phoenix/pages/playground/openAIReasoningEffort";
import { assertUnreachable } from "@phoenix/typeUtils";

// Schemas parse the snake_case shape recorded on spans and transform to
// camelCase output.

const anthropicThinkingInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("disabled") }),
  z.object({
    type: z.literal("enabled"),
    budget_tokens: z.number(),
    display: z.string().optional(),
  }),
  z.object({
    type: z.literal("adaptive"),
    display: z.string().optional(),
  }),
]);

export type AnthropicThinkingDisabled = { type: "disabled" };
export type AnthropicThinkingEnabled = {
  type: "enabled";
  budgetTokens: number;
  display?: string;
};
export type AnthropicThinkingAdaptive = {
  type: "adaptive";
  display?: string;
};
export type AnthropicThinking =
  | AnthropicThinkingDisabled
  | AnthropicThinkingEnabled
  | AnthropicThinkingAdaptive;

function transformAnthropicThinking(
  input: z.infer<typeof anthropicThinkingInputSchema>
): AnthropicThinking {
  switch (input.type) {
    case "disabled":
      return { type: "disabled" };
    case "enabled": {
      const out: AnthropicThinkingEnabled = {
        type: "enabled",
        budgetTokens: input.budget_tokens,
      };
      if (input.display !== undefined) out.display = input.display;
      return out;
    }
    case "adaptive": {
      const out: AnthropicThinkingAdaptive = { type: "adaptive" };
      if (input.display !== undefined) out.display = input.display;
      return out;
    }
    default:
      return assertUnreachable(input);
  }
}

const googleThinkingConfigInputSchema = z.object({
  thinking_budget: z.number().optional().catch(undefined),
  thinking_level: z.string().optional().catch(undefined),
  include_thoughts: z.boolean().optional().catch(undefined),
});

export type GoogleThinkingConfig = {
  thinkingBudget?: number;
  thinkingLevel?: string;
  includeThoughts?: boolean;
};

function transformGoogleThinkingConfig(
  input: z.infer<typeof googleThinkingConfigInputSchema>
): GoogleThinkingConfig {
  const out: GoogleThinkingConfig = {};
  if (input.thinking_budget !== undefined)
    out.thinkingBudget = input.thinking_budget;
  if (input.thinking_level !== undefined)
    out.thinkingLevel = input.thinking_level;
  if (input.include_thoughts !== undefined)
    out.includeThoughts = input.include_thoughts;
  return out;
}

// AWS Bedrock records inferenceConfig in camelCase (AWS SDK convention),
// so no snake_case→camelCase rename is needed inside it.
const awsInferenceConfigInputSchema = z.object({
  maxTokens: z.number().optional().catch(undefined),
  temperature: z.number().optional().catch(undefined),
  topP: z.number().optional().catch(undefined),
  stopSequences: z.array(z.string()).optional().catch(undefined),
});

export type AwsInferenceConfig = z.infer<typeof awsInferenceConfigInputSchema>;

/** OpenAI canonical: only the keys the writer / form-store consume. */
export interface OpenAIInvocationParameters {
  temperature?: number;
  topP?: number;
  maxCompletionTokens?: number;
  reasoningEffort?: string;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
  stop?: string[];
  extraBody?: unknown;
  [key: string]: unknown;
}

/**
 * OpenAI raw: what the schema/reader produces before canonicalization. Adds
 * the deprecated `maxTokens`, the Responses-API alternate `maxOutputTokens`,
 * and the Responses-API nested `reasoning.effort`. Canonicalization moves
 * each into its canonical peer (`maxCompletionTokens`, `reasoningEffort`)
 * and deletes the alternate.
 */
export interface RawOpenAIInvocationParameters extends OpenAIInvocationParameters {
  maxTokens?: number;
  maxOutputTokens?: number;
  reasoning?: { effort?: string };
}

export interface AnthropicInvocationParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  outputConfig?: { effort?: string };
  thinking?: AnthropicThinking;
  extraBody?: unknown;
  [key: string]: unknown;
}

export interface GoogleInvocationParameters {
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  thinkingConfig?: GoogleThinkingConfig;
  [key: string]: unknown;
}

/** AWS canonical: only the flat top-level keys the writer / form-store consume. */
export interface AwsInvocationParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  [key: string]: unknown;
}

/**
 * AWS raw: what the schema produces before canonicalization. Carries the
 * nested `inferenceConfig` shape AWS Bedrock instrumentation records.
 * Canonicalization lifts `inferenceConfig.*` into the flat top-level keys
 * and deletes the nested object.
 */
export interface RawAwsInvocationParameters extends AwsInvocationParameters {
  inferenceConfig?: AwsInferenceConfig;
}

export type OpenAIInvocationParametersRecord = {
  family: typeof InvocationFamily.OPENAI;
  parameters: OpenAIInvocationParameters;
};
export type AnthropicInvocationParametersRecord = {
  family: typeof InvocationFamily.ANTHROPIC;
  parameters: AnthropicInvocationParameters;
};
export type GoogleInvocationParametersRecord = {
  family: typeof InvocationFamily.GOOGLE_GENAI;
  parameters: GoogleInvocationParameters;
};
export type AwsInvocationParametersRecord = {
  family: typeof InvocationFamily.AWS_BEDROCK;
  parameters: AwsInvocationParameters;
};

/**
 * Canonical bridge record: post-canonicalization. The writer and form-store
 * consume this. Reading `record.parameters` is guaranteed to see only the
 * canonical key set for the family.
 */
export type PromptInvocationParametersRecord =
  | OpenAIInvocationParametersRecord
  | AnthropicInvocationParametersRecord
  | GoogleInvocationParametersRecord
  | AwsInvocationParametersRecord;

export type RawOpenAIInvocationParametersRecord = {
  family: typeof InvocationFamily.OPENAI;
  parameters: RawOpenAIInvocationParameters;
};
export type RawAwsInvocationParametersRecord = {
  family: typeof InvocationFamily.AWS_BEDROCK;
  parameters: RawAwsInvocationParameters;
};

/**
 * Raw bridge record: pre-canonicalization. The schema and reader produce
 * this. Carries the legacy/alternate wire shapes that need to be folded into
 * canonical keys before the writer or form-store sees them.
 */
export type RawPromptInvocationParametersRecord =
  | RawOpenAIInvocationParametersRecord
  | AnthropicInvocationParametersRecord
  | GoogleInvocationParametersRecord
  | RawAwsInvocationParametersRecord;

export function emptyPromptInvocationParametersRecord(
  family: InvocationFamily
): PromptInvocationParametersRecord {
  switch (family) {
    case InvocationFamily.OPENAI:
      return { family: InvocationFamily.OPENAI, parameters: {} };
    case InvocationFamily.ANTHROPIC:
      return { family: InvocationFamily.ANTHROPIC, parameters: {} };
    case InvocationFamily.GOOGLE_GENAI:
      return { family: InvocationFamily.GOOGLE_GENAI, parameters: {} };
    case InvocationFamily.AWS_BEDROCK:
      return { family: InvocationFamily.AWS_BEDROCK, parameters: {} };
    default:
      return assertUnreachable(family);
  }
}

export function emptyRawPromptInvocationParametersRecord(
  family: InvocationFamily
): RawPromptInvocationParametersRecord {
  return emptyPromptInvocationParametersRecord(family);
}

// Per-family schemas: snake_case input → camelCase raw output. Each named
// field uses `.catch(undefined)` so a malformed value drops just that field.

const openAIInputSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  top_p: z.number().optional().catch(undefined),
  max_completion_tokens: z.number().optional().catch(undefined),
  reasoning_effort: z.string().optional().catch(undefined),
  frequency_penalty: z.number().optional().catch(undefined),
  presence_penalty: z.number().optional().catch(undefined),
  seed: z.number().optional().catch(undefined),
  stop: z.array(z.string()).optional().catch(undefined),
  max_output_tokens: z.number().optional().catch(undefined),
  reasoning: z
    .looseObject({ effort: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined),
  max_tokens: z.number().optional().catch(undefined),
  extra_body: z.unknown().optional(),
});

export const openAIInvocationParametersRecordSchema =
  openAIInputSchema.transform((input): RawOpenAIInvocationParametersRecord => {
    const {
      temperature,
      top_p,
      max_completion_tokens,
      reasoning_effort,
      frequency_penalty,
      presence_penalty,
      seed,
      stop,
      max_output_tokens,
      reasoning,
      max_tokens,
      extra_body,
      ...passthrough
    } = input;
    const parameters: RawOpenAIInvocationParameters = { ...passthrough };
    if (temperature !== undefined) parameters.temperature = temperature;
    if (top_p !== undefined) parameters.topP = top_p;
    if (max_completion_tokens !== undefined)
      parameters.maxCompletionTokens = max_completion_tokens;
    // Span attributes reflect SDK conventions; normalize to the form's
    // lowercase IDs so reload from a span matches the form Select's option set.
    const reasoningEffortFormValue =
      toOpenAIReasoningEffortFormValue(reasoning_effort);
    if (reasoningEffortFormValue !== undefined)
      parameters.reasoningEffort = reasoningEffortFormValue;
    if (frequency_penalty !== undefined)
      parameters.frequencyPenalty = frequency_penalty;
    if (presence_penalty !== undefined)
      parameters.presencePenalty = presence_penalty;
    if (seed !== undefined) parameters.seed = seed;
    if (stop !== undefined) parameters.stop = stop;
    if (max_output_tokens !== undefined)
      parameters.maxOutputTokens = max_output_tokens;
    if (reasoning !== undefined) parameters.reasoning = reasoning;
    if (max_tokens !== undefined) parameters.maxTokens = max_tokens;
    if (extra_body !== undefined) parameters.extraBody = extra_body;
    return { family: InvocationFamily.OPENAI, parameters };
  });

const anthropicInputSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  top_p: z.number().optional().catch(undefined),
  stop_sequences: z.array(z.string()).optional().catch(undefined),
  max_tokens: z.number().optional().catch(undefined),
  thinking: anthropicThinkingInputSchema.optional().catch(undefined),
  output_config: z
    .looseObject({ effort: z.string().optional().catch(undefined) })
    .optional()
    .catch(undefined),
  extra_body: z.unknown().optional(),
});

export const anthropicInvocationParametersRecordSchema =
  anthropicInputSchema.transform(
    (input): AnthropicInvocationParametersRecord => {
      const {
        temperature,
        top_p,
        stop_sequences,
        max_tokens,
        thinking,
        output_config,
        extra_body,
        ...passthrough
      } = input;
      const parameters: AnthropicInvocationParameters = { ...passthrough };
      if (temperature !== undefined) parameters.temperature = temperature;
      if (top_p !== undefined) parameters.topP = top_p;
      if (stop_sequences !== undefined)
        parameters.stopSequences = stop_sequences;
      if (max_tokens !== undefined) parameters.maxTokens = max_tokens;
      if (thinking !== undefined)
        parameters.thinking = transformAnthropicThinking(thinking);
      if (output_config !== undefined) parameters.outputConfig = output_config;
      if (extra_body !== undefined) parameters.extraBody = extra_body;
      return { family: InvocationFamily.ANTHROPIC, parameters };
    }
  );

const googleInputSchema = z.looseObject({
  temperature: z.number().optional().catch(undefined),
  max_output_tokens: z.number().optional().catch(undefined),
  stop_sequences: z.array(z.string()).optional().catch(undefined),
  top_p: z.number().optional().catch(undefined),
  top_k: z.number().optional().catch(undefined),
  presence_penalty: z.number().optional().catch(undefined),
  frequency_penalty: z.number().optional().catch(undefined),
  thinking_config: googleThinkingConfigInputSchema.optional().catch(undefined),
});

export const googleInvocationParametersRecordSchema =
  googleInputSchema.transform((input): GoogleInvocationParametersRecord => {
    const {
      temperature,
      max_output_tokens,
      stop_sequences,
      top_p,
      top_k,
      presence_penalty,
      frequency_penalty,
      thinking_config,
      ...passthrough
    } = input;
    const parameters: GoogleInvocationParameters = { ...passthrough };
    if (temperature !== undefined) parameters.temperature = temperature;
    if (max_output_tokens !== undefined)
      parameters.maxOutputTokens = max_output_tokens;
    if (stop_sequences !== undefined) parameters.stopSequences = stop_sequences;
    if (top_p !== undefined) parameters.topP = top_p;
    if (top_k !== undefined) parameters.topK = top_k;
    if (presence_penalty !== undefined)
      parameters.presencePenalty = presence_penalty;
    if (frequency_penalty !== undefined)
      parameters.frequencyPenalty = frequency_penalty;
    if (thinking_config !== undefined)
      parameters.thinkingConfig =
        transformGoogleThinkingConfig(thinking_config);
    return { family: InvocationFamily.GOOGLE_GENAI, parameters };
  });

const awsInputSchema = z.looseObject({
  inferenceConfig: awsInferenceConfigInputSchema.optional().catch(undefined),
});

export const awsInvocationParametersRecordSchema = awsInputSchema.transform(
  (input): RawAwsInvocationParametersRecord => {
    const { inferenceConfig, ...passthrough } = input;
    const parameters: RawAwsInvocationParameters = { ...passthrough };
    if (inferenceConfig !== undefined)
      parameters.inferenceConfig = inferenceConfig;
    return { family: InvocationFamily.AWS_BEDROCK, parameters };
  }
);

/**
 * Per-family schema lookup — used by `normalizeSpanInvocationParameters` to
 * pick the right validator at the span ingest boundary, given the family
 * resolved from `llm.system` / `llm.provider`.
 */
export const INVOCATION_PARAMETERS_SCHEMA_BY_FAMILY = {
  [InvocationFamily.OPENAI]: openAIInvocationParametersRecordSchema,
  [InvocationFamily.ANTHROPIC]: anthropicInvocationParametersRecordSchema,
  [InvocationFamily.GOOGLE_GENAI]: googleInvocationParametersRecordSchema,
  [InvocationFamily.AWS_BEDROCK]: awsInvocationParametersRecordSchema,
} as const satisfies Record<InvocationFamily, z.ZodType>;

function pickExtraBody(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function normalizeAnthropicThinkingDisplay(
  value: unknown
): AnthropicThinkingDisplay | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase();
  if (upper === "SUMMARIZED" || upper === "OMITTED") return upper;
  return undefined;
}

function normalizeAnthropicOutputConfigEffort(
  value: unknown
): AnthropicOutputConfigEffort | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase();
  if (
    upper === "LOW" ||
    upper === "MEDIUM" ||
    upper === "HIGH" ||
    upper === "XHIGH" ||
    upper === "MAX"
  ) {
    return upper;
  }
  return undefined;
}

function normalizeGoogleThinkingLevel(
  value: unknown
): GoogleThinkingLevel | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase();
  if (
    upper === "MINIMAL" ||
    upper === "LOW" ||
    upper === "MEDIUM" ||
    upper === "HIGH"
  ) {
    return upper;
  }
  return undefined;
}

function buildGoogleThinkingConfigInput(
  config: GoogleThinkingConfig
): PromptGoogleThinkingConfigInput | undefined {
  const out: PromptGoogleThinkingConfigInput = {};
  if (config.thinkingBudget !== undefined)
    out.thinkingBudget = config.thinkingBudget;
  const level = normalizeGoogleThinkingLevel(config.thinkingLevel);
  if (level !== undefined) out.thinkingLevel = level;
  if (config.includeThoughts !== undefined)
    out.includeThoughts = config.includeThoughts;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function readPromptInvocationParametersUnion(
  data: PromptInvocationParametersReadableFragment$data
): RawPromptInvocationParametersRecord {
  switch (data.__typename) {
    case "PromptOpenAIInvocationParameters": {
      const parameters: RawOpenAIInvocationParameters = {};
      if (data.temperature != null) parameters.temperature = data.temperature;
      if (data.openaiMaxTokens != null)
        parameters.maxTokens = data.openaiMaxTokens;
      if (data.maxCompletionTokens != null)
        parameters.maxCompletionTokens = data.maxCompletionTokens;
      if (data.frequencyPenalty != null)
        parameters.frequencyPenalty = data.frequencyPenalty;
      if (data.presencePenalty != null)
        parameters.presencePenalty = data.presencePenalty;
      if (data.topP != null) parameters.topP = data.topP;
      if (data.seed != null) parameters.seed = data.seed;
      if (data.stop != null) parameters.stop = [...data.stop];
      // GraphQL enum is uppercase (`HIGH`, `LOW`, …) but the form Select uses
      // lowercase IDs; map back to the form casing on the read side.
      const reasoningEffortFormValue = toOpenAIReasoningEffortFormValue(
        data.reasoningEffort
      );
      if (reasoningEffortFormValue !== undefined)
        parameters.reasoningEffort = reasoningEffortFormValue;
      const extraBody = pickExtraBody(data.extraBody);
      if (extraBody != null) parameters.extraBody = extraBody;
      return { family: InvocationFamily.OPENAI, parameters };
    }
    case "PromptAnthropicInvocationParameters": {
      const parameters: AnthropicInvocationParameters = {
        maxTokens: data.anthropicMaxTokens,
      };
      if (data.temperature != null) parameters.temperature = data.temperature;
      if (data.topP != null) parameters.topP = data.topP;
      if (data.stopSequences != null)
        parameters.stopSequences = [...data.stopSequences];
      if (data.outputConfig?.effort != null) {
        parameters.outputConfig = { effort: data.outputConfig.effort };
      }
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
            if (data.thinking.enabledDisplay != null) {
              enabled.display = data.thinking.enabledDisplay;
            }
            parameters.thinking = enabled;
            break;
          }
          case "PromptAnthropicThinkingAdaptive": {
            const adaptive: AnthropicThinkingAdaptive = { type: "adaptive" };
            if (data.thinking.adaptiveDisplay != null) {
              adaptive.display = data.thinking.adaptiveDisplay;
            }
            parameters.thinking = adaptive;
            break;
          }
          case "%other":
            // Forward-compat: a thinking variant added server-side that this
            // client doesn't know — drop it rather than half-render.
            break;
          default:
            assertUnreachable(data.thinking);
        }
      }
      const extraBody = pickExtraBody(data.extraBody);
      if (extraBody != null) parameters.extraBody = extraBody;
      return { family: InvocationFamily.ANTHROPIC, parameters };
    }
    case "PromptGoogleInvocationParameters": {
      const parameters: GoogleInvocationParameters = {};
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
        const tc: GoogleThinkingConfig = {};
        if (data.thinkingConfig.thinkingBudget != null)
          tc.thinkingBudget = data.thinkingConfig.thinkingBudget;
        if (data.thinkingConfig.thinkingLevel != null)
          tc.thinkingLevel = data.thinkingConfig.thinkingLevel;
        if (data.thinkingConfig.includeThoughts != null)
          tc.includeThoughts = data.thinkingConfig.includeThoughts;
        if (Object.keys(tc).length > 0) parameters.thinkingConfig = tc;
      }
      return { family: InvocationFamily.GOOGLE_GENAI, parameters };
    }
    case "PromptAwsInvocationParameters": {
      const parameters: RawAwsInvocationParameters = {};
      if (data.awsMaxTokens != null) parameters.maxTokens = data.awsMaxTokens;
      if (data.temperature != null) parameters.temperature = data.temperature;
      if (data.topP != null) parameters.topP = data.topP;
      if (data.stopSequences != null)
        parameters.stopSequences = [...data.stopSequences];
      return { family: InvocationFamily.AWS_BEDROCK, parameters };
    }
    case "%other":
      throw new Error(
        "Unsupported prompt invocation parameters typename: %other"
      );
    default:
      return assertUnreachable(data);
  }
}

function buildAnthropicThinkingInput(
  thinking: AnthropicThinking
): PromptAnthropicThinkingConfigInput {
  switch (thinking.type) {
    case "disabled":
      return { disabled: { disabled: true } };
    case "enabled":
      return {
        enabled: {
          budgetTokens: thinking.budgetTokens,
          display: normalizeAnthropicThinkingDisplay(thinking.display),
        },
      };
    case "adaptive":
      return {
        adaptive: {
          display: normalizeAnthropicThinkingDisplay(thinking.display),
        },
      };
    default:
      return assertUnreachable(thinking);
  }
}

export function writePromptInvocationParametersMutationInput(
  record: PromptInvocationParametersRecord
): ChatPromptVersionInput["invocationParameters"] {
  switch (record.family) {
    case InvocationFamily.OPENAI: {
      const p = record.parameters;
      return {
        openai: {
          temperature: p.temperature,
          maxCompletionTokens: p.maxCompletionTokens,
          frequencyPenalty: p.frequencyPenalty,
          presencePenalty: p.presencePenalty,
          topP: p.topP,
          seed: p.seed,
          stop: p.stop,
          reasoningEffort: parseOpenAIReasoningEffort(p.reasoningEffort),
          extraBody: pickExtraBody(p.extraBody),
        },
      };
    }
    case InvocationFamily.ANTHROPIC: {
      const p = record.parameters;
      if (p.maxTokens == null) {
        throw new Error("Anthropic invocation parameters require maxTokens");
      }
      const outputConfigEffort = normalizeAnthropicOutputConfigEffort(
        p.outputConfig?.effort
      );
      return {
        anthropic: {
          maxTokens: p.maxTokens,
          temperature: p.temperature,
          topP: p.topP,
          stopSequences: p.stopSequences,
          outputConfig: outputConfigEffort
            ? { effort: outputConfigEffort }
            : undefined,
          thinking: p.thinking
            ? buildAnthropicThinkingInput(p.thinking)
            : undefined,
          extraBody: pickExtraBody(p.extraBody),
        },
      };
    }
    case InvocationFamily.GOOGLE_GENAI: {
      const p = record.parameters;
      return {
        google: {
          temperature: p.temperature,
          maxOutputTokens: p.maxOutputTokens,
          stopSequences: p.stopSequences,
          presencePenalty: p.presencePenalty,
          frequencyPenalty: p.frequencyPenalty,
          topP: p.topP,
          topK: p.topK,
          thinkingConfig: p.thinkingConfig
            ? buildGoogleThinkingConfigInput(p.thinkingConfig)
            : undefined,
        },
      };
    }
    case InvocationFamily.AWS_BEDROCK: {
      const p = record.parameters;
      return {
        aws: {
          maxTokens: p.maxTokens,
          temperature: p.temperature,
          topP: p.topP,
          stopSequences: p.stopSequences,
        },
      };
    }
    default:
      return assertUnreachable(record);
  }
}
