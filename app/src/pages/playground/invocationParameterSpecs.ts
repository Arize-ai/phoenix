/**
 * Frontend-owned invocation parameter metadata (labels, bounds, widget kinds).
 *
 * This file is intentionally pure data + simple helpers. Provider adapters
 * project these static specs into the visible form fields for a model/config.
 */

import { assertUnreachable } from "@phoenix/typeUtils";

import {
  ANTHROPIC_OUTPUT_CONFIG_EFFORT_FORM_VALUES,
  ANTHROPIC_THINKING_DISPLAY_FORM_VALUES,
  ANTHROPIC_THINKING_TYPE_VALUES,
  GOOGLE_THINKING_LEVEL_FORM_VALUES,
  OPENAI_REASONING_EFFORT_FORM_VALUES,
} from "./invocationParameterEnumOptions";

// Canonical names group provider-specific fields that represent the same
// parameter concept, such as Anthropic `maxTokens` and Google
// `maxOutputTokens`.
type CanonicalParameterName =
  | "ANTHROPIC_EXTENDED_THINKING"
  | "MAX_COMPLETION_TOKENS"
  | "RANDOM_SEED"
  | "REASONING_EFFORT"
  | "RESPONSE_FORMAT"
  | "STOP_SEQUENCES"
  | "TEMPERATURE"
  | "TOP_P";

/**
 * Discriminator for Phoenix's canonical, normalized invocation-parameter
 * representation. Each family corresponds to one of the canonical config
 * shapes — `OpenAIConfig`, `AnthropicConfig`, `GoogleConfig`, `AwsConfig` —
 * and selects which provider adapter (storage, form-field projection, prompt
 * serialization) to use.
 *
 * The grouping is about Phoenix's internal representation, not SDK wire
 * formats. The many providers under `OPENAI` (AZURE_OPENAI, DEEPSEEK, XAI,
 * GROQ, TOGETHER, OLLAMA, …) all consume the OpenAI SDK in practice, but
 * what makes them share a family here is that Phoenix stores and edits
 * their invocation parameters with one canonical shape.
 */
export const InvocationFamily = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GOOGLE_GENAI: "google_genai",
  AWS_BEDROCK: "aws_bedrock",
} as const;
export type InvocationFamily =
  (typeof InvocationFamily)[keyof typeof InvocationFamily];

/**
 * Resolves the canonical-config family for a given `ModelProvider`. Used to
 * pick the right Phoenix provider adapter (canonical config type, form-field
 * projection, prompt serialization) for a model.
 *
 * See {@link InvocationFamily} for what the family represents.
 */
export function getInvocationFamilyForProvider(
  provider: ModelProvider
): InvocationFamily {
  switch (provider) {
    case "OPENAI":
    case "AZURE_OPENAI":
    case "DEEPSEEK":
    case "XAI":
    case "OLLAMA":
    case "CEREBRAS":
    case "FIREWORKS":
    case "GROQ":
    case "MOONSHOT":
    case "MINIMAX":
    case "PERPLEXITY":
    case "TOGETHER":
      return InvocationFamily.OPENAI;
    case "ANTHROPIC":
      return InvocationFamily.ANTHROPIC;
    case "GOOGLE":
      return InvocationFamily.GOOGLE_GENAI;
    case "AWS":
      return InvocationFamily.AWS_BEDROCK;
  }
  return assertUnreachable(provider);
}

type CommonSpec = {
  name: string;
  label: string;
  required?: boolean;
  applicableOpenAIApiTypes?: readonly ("CHAT_COMPLETIONS" | "RESPONSES")[];
  canonicalName?: CanonicalParameterName;
};

export type ParamSpec =
  | (CommonSpec & { type: "int"; min?: number; max?: number })
  | (CommonSpec & { type: "float"; min?: number; max?: number })
  | (CommonSpec & { type: "string" })
  | (CommonSpec & { type: "bool" })
  | (CommonSpec & { type: "string_list" })
  | (CommonSpec & {
      type: "enum";
      values: readonly string[];
      labels?: Readonly<Record<string, string>>;
    });

export const OPENAI_INVOCATION_PARAMETERS = [
  {
    name: "temperature",
    type: "float",
    min: 0,
    max: 2,
    label: "Temperature",
    canonicalName: "TEMPERATURE",
  },
  {
    name: "topP",
    type: "float",
    min: 0,
    max: 1,
    label: "Top P",
    canonicalName: "TOP_P",
  },
  {
    name: "maxCompletionTokens",
    type: "int",
    label: "Max Completion Tokens",
    canonicalName: "MAX_COMPLETION_TOKENS",
  },
  {
    name: "frequencyPenalty",
    type: "float",
    min: -2,
    max: 2,
    label: "Frequency Penalty",
    applicableOpenAIApiTypes: ["CHAT_COMPLETIONS"] as const,
  },
  {
    name: "presencePenalty",
    type: "float",
    min: -2,
    max: 2,
    label: "Presence Penalty",
    applicableOpenAIApiTypes: ["CHAT_COMPLETIONS"] as const,
  },
  {
    name: "reasoningEffort",
    type: "enum",
    values: OPENAI_REASONING_EFFORT_FORM_VALUES,
    label: "Reasoning Effort",
    canonicalName: "REASONING_EFFORT",
  },
  {
    name: "seed",
    type: "int",
    label: "Seed",
    canonicalName: "RANDOM_SEED",
  },
] as const satisfies readonly ParamSpec[];

export const ANTHROPIC_INVOCATION_PARAMETERS = [
  {
    name: "maxTokens",
    type: "int",
    label: "Max Tokens",
    required: true,
    // Keep above the default thinking budget (1024) so enabling Anthropic
    // thinking starts from a valid budget < max_tokens configuration.
    canonicalName: "MAX_COMPLETION_TOKENS",
  },
  {
    name: "temperature",
    type: "float",
    min: 0,
    max: 1,
    label: "Temperature",
    canonicalName: "TEMPERATURE",
  },
  {
    name: "stopSequences",
    type: "string_list",
    label: "Stop Sequences",
    canonicalName: "STOP_SEQUENCES",
  },
  {
    name: "topP",
    type: "float",
    min: 0,
    max: 1,
    label: "Top P",
    canonicalName: "TOP_P",
  },
  {
    name: "thinkingType",
    type: "enum",
    values: ANTHROPIC_THINKING_TYPE_VALUES,
    label: "Thinking",
    canonicalName: "ANTHROPIC_EXTENDED_THINKING",
  },
  {
    name: "thinkingBudgetTokens",
    type: "int",
    // Anthropic's documented minimum for `thinking.budget_tokens`. Upper bound
    // is synthesized at resolve time from the current `maxTokens` row (strict
    // less-than per the API contract).
    min: 1024,
    label: "Budget Tokens",
  },
  {
    name: "thinkingDisplay",
    type: "enum",
    values: ANTHROPIC_THINKING_DISPLAY_FORM_VALUES,
    label: "Thinking Display",
  },
  {
    name: "effort",
    type: "enum",
    values: ANTHROPIC_OUTPUT_CONFIG_EFFORT_FORM_VALUES,
    label: "Effort",
    canonicalName: "REASONING_EFFORT",
  },
] as const satisfies readonly ParamSpec[];

export const GOOGLE_INVOCATION_PARAMETERS = [
  {
    name: "temperature",
    type: "float",
    min: 0,
    max: 2,
    label: "Temperature",
    canonicalName: "TEMPERATURE",
  },
  {
    name: "maxOutputTokens",
    type: "int",
    label: "Max Output Tokens",
    canonicalName: "MAX_COMPLETION_TOKENS",
  },
  {
    name: "stopSequences",
    type: "string_list",
    label: "Stop Sequences",
    canonicalName: "STOP_SEQUENCES",
  },
  {
    name: "presencePenalty",
    type: "float",
    label: "Presence Penalty",
  },
  {
    name: "frequencyPenalty",
    type: "float",
    label: "Frequency Penalty",
  },
  {
    name: "topP",
    type: "float",
    min: 0,
    max: 1,
    label: "Top P",
    canonicalName: "TOP_P",
  },
  {
    name: "topK",
    type: "int",
    label: "Top K",
  },
  {
    name: "thinkingBudget",
    type: "int",
    min: 0,
    label: "Thinking Budget",
  },
  {
    name: "thinkingLevel",
    type: "enum",
    values: GOOGLE_THINKING_LEVEL_FORM_VALUES,
    label: "Thinking Level",
  },
  {
    name: "includeThoughts",
    type: "bool",
    label: "Include Thoughts",
  },
] as const satisfies readonly ParamSpec[];

export const AWS_INVOCATION_PARAMETERS = [
  {
    name: "maxTokens",
    type: "int",
    label: "Max Tokens",
    canonicalName: "MAX_COMPLETION_TOKENS",
  },
  {
    name: "temperature",
    type: "float",
    min: 0,
    max: 1,
    label: "Temperature",
    canonicalName: "TEMPERATURE",
  },
  {
    name: "topP",
    type: "float",
    min: 0,
    max: 1,
    label: "Top P",
    canonicalName: "TOP_P",
  },
] as const satisfies readonly ParamSpec[];

export const INVOCATION_PARAMETERS: Record<
  InvocationFamily,
  readonly ParamSpec[]
> = {
  [InvocationFamily.OPENAI]: OPENAI_INVOCATION_PARAMETERS,
  [InvocationFamily.ANTHROPIC]: ANTHROPIC_INVOCATION_PARAMETERS,
  [InvocationFamily.GOOGLE_GENAI]: GOOGLE_INVOCATION_PARAMETERS,
  [InvocationFamily.AWS_BEDROCK]: AWS_INVOCATION_PARAMETERS,
};

export function getSpecsForFamily<F extends InvocationFamily>(
  family: F
): (typeof INVOCATION_PARAMETERS)[F] {
  return INVOCATION_PARAMETERS[family];
}
