/**
 * Frontend-owned invocation parameter metadata (labels, bounds, widget kinds).
 */

import { DEFAULT_OPENAI_API_TYPE } from "@phoenix/constants/generativeConstants";
import type { ModelConfig } from "@phoenix/store/playground";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { CanonicalParameterName } from "./invocationParameterUtils";

export const InvocationFamily = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GOOGLE_GENAI: "google_genai",
  AWS_BEDROCK: "aws_bedrock",
} as const;
export type InvocationFamily =
  (typeof InvocationFamily)[keyof typeof InvocationFamily];

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
  wirePath?: string;
  label: string;
  required?: boolean;
  ui?: "anthropic_thinking";
  applicableOpenAIApiTypes?: readonly ("CHAT_COMPLETIONS" | "RESPONSES")[];
  /** Optional default merged when syncing specs (server defaults formerly came from GraphQL). */
  defaultValue?: unknown;
  canonicalName?: CanonicalParameterName;
};

export type ParamSpec =
  | (CommonSpec & { type: "int"; min?: number; max?: number })
  | (CommonSpec & {
      type: "float" | "bounded_float";
      min?: number;
      max?: number;
    })
  | (CommonSpec & { type: "string" })
  | (CommonSpec & { type: "bool" })
  | (CommonSpec & { type: "string_list" })
  | (CommonSpec & { type: "json" })
  | (CommonSpec & {
      type: "enum";
      values: readonly string[];
      labels?: Readonly<Record<string, string>>;
    });

export const OPENAI_INVOCATION_PARAMETERS = [
  {
    name: "temperature",
    type: "bounded_float",
    min: 0,
    max: 2,
    label: "Temperature",
    canonicalName: "TEMPERATURE",
  },
  {
    name: "topP",
    type: "bounded_float",
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
    type: "bounded_float",
    min: -2,
    max: 2,
    label: "Frequency Penalty",
    defaultValue: 0,
    applicableOpenAIApiTypes: ["CHAT_COMPLETIONS"] as const,
  },
  {
    name: "presencePenalty",
    type: "bounded_float",
    min: -2,
    max: 2,
    label: "Presence Penalty",
    defaultValue: 0,
    applicableOpenAIApiTypes: ["CHAT_COMPLETIONS"] as const,
  },
  {
    name: "reasoningEffort",
    type: "enum",
    values: ["none", "minimal", "low", "medium", "high", "xhigh"] as const,
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
    defaultValue: 1024,
    canonicalName: "MAX_COMPLETION_TOKENS",
  },
  {
    name: "temperature",
    type: "bounded_float",
    min: 0,
    max: 1,
    label: "Temperature",
    defaultValue: 1,
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
    type: "bounded_float",
    min: 0,
    max: 1,
    label: "Top P",
    canonicalName: "TOP_P",
  },
  {
    name: "thinking",
    type: "json",
    label: "Thinking",
    ui: "anthropic_thinking",
    canonicalName: "ANTHROPIC_EXTENDED_THINKING",
  },
] as const satisfies readonly ParamSpec[];

export const GOOGLE_INVOCATION_PARAMETERS = [
  {
    name: "temperature",
    type: "bounded_float",
    min: 0,
    max: 2,
    label: "Temperature",
    defaultValue: 1,
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
    defaultValue: 0,
  },
  {
    name: "frequencyPenalty",
    type: "float",
    label: "Frequency Penalty",
    defaultValue: 0,
  },
  {
    name: "topP",
    type: "bounded_float",
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
] as const satisfies readonly ParamSpec[];

export const AWS_INVOCATION_PARAMETERS = [
  {
    name: "maxTokens",
    type: "int",
    label: "Max Tokens",
    defaultValue: 1024,
    canonicalName: "MAX_COMPLETION_TOKENS",
  },
  {
    name: "temperature",
    type: "bounded_float",
    min: 0,
    max: 1,
    label: "Temperature",
    defaultValue: 1,
    canonicalName: "TEMPERATURE",
  },
  {
    name: "topP",
    type: "bounded_float",
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

/**
 * Specs applicable to the current playground model (filters OpenAI family by API type).
 */
export function getActiveSpecsForPlayground(
  model: Pick<ModelConfig, "provider" | "openaiApiType">
): readonly ParamSpec[] {
  const family = getInvocationFamilyForProvider(model.provider);
  const specs = [...INVOCATION_PARAMETERS[family]];
  if (family !== InvocationFamily.OPENAI) {
    return specs;
  }
  const api = model.openaiApiType ?? DEFAULT_OPENAI_API_TYPE;
  return specs.filter((s) => {
    if (!("applicableOpenAIApiTypes" in s) || !s.applicableOpenAIApiTypes) {
      return true;
    }
    return s.applicableOpenAIApiTypes.includes(api);
  });
}

export function invocationValueKeyForSpec(
  spec: ParamSpec
):
  | "valueBool"
  | "valueBoolean"
  | "valueFloat"
  | "valueInt"
  | "valueJson"
  | "valueString"
  | "valueStringList" {
  switch (spec.type) {
    case "int":
      return "valueInt";
    case "float":
    case "bounded_float":
      return "valueFloat";
    case "string":
    case "enum":
      return "valueString";
    case "bool":
      return "valueBool";
    case "string_list":
      return "valueStringList";
    case "json":
      return "valueJson";
  }
}
