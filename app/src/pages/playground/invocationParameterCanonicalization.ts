import { assertUnreachable } from "@phoenix/typeUtils";

import { InvocationFamily } from "./invocationParameterSpecs";
import type {
  AnthropicInvocationParametersRecord,
  AwsInvocationParameters,
  AwsInvocationParametersRecord,
  GoogleInvocationParametersRecord,
  OpenAIInvocationParameters,
  OpenAIInvocationParametersRecord,
  PromptInvocationParametersRecord,
  RawAwsInvocationParametersRecord,
  RawOpenAIInvocationParametersRecord,
  RawPromptInvocationParametersRecord,
} from "./promptInvocationParameterCodecs";

type CanonicalizeInvocationParametersOptions = {
  openaiApiType?: OpenAIApiType | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function canonicalizeOpenAI(
  record: RawOpenAIInvocationParametersRecord,
  openaiApiType: OpenAIApiType | null
): OpenAIInvocationParametersRecord {
  const { maxTokens, maxOutputTokens, reasoning, ...rest } = record.parameters;
  const parameters: OpenAIInvocationParameters = { ...rest };

  if (
    typeof maxTokens === "number" &&
    parameters.maxCompletionTokens === undefined
  ) {
    parameters.maxCompletionTokens = maxTokens;
  }

  if (openaiApiType === "RESPONSES") {
    if (
      typeof maxOutputTokens === "number" &&
      parameters.maxCompletionTokens === undefined
    ) {
      parameters.maxCompletionTokens = maxOutputTokens;
    }
    if (isPlainObject(reasoning)) {
      const effort = reasoning.effort;
      if (
        typeof effort === "string" &&
        parameters.reasoningEffort === undefined
      ) {
        parameters.reasoningEffort = effort;
      }
    }
  }

  return { family: InvocationFamily.OPENAI, parameters };
}

function canonicalizeAws(
  record: RawAwsInvocationParametersRecord
): AwsInvocationParametersRecord {
  // AWS Bedrock spans record `inferenceConfig` (camelCase per the AWS SDK
  // convention) as a nested object. Lift its keys to top level so the
  // form-store helpers see them via the spec table without special casing,
  // then drop the nested form — canonical AWS is flat-only.
  const { inferenceConfig, ...rest } = record.parameters;
  const parameters: AwsInvocationParameters = { ...rest };
  if (inferenceConfig) {
    if (
      inferenceConfig.maxTokens !== undefined &&
      parameters.maxTokens === undefined
    ) {
      parameters.maxTokens = inferenceConfig.maxTokens;
    }
    if (
      inferenceConfig.temperature !== undefined &&
      parameters.temperature === undefined
    ) {
      parameters.temperature = inferenceConfig.temperature;
    }
    if (inferenceConfig.topP !== undefined && parameters.topP === undefined) {
      parameters.topP = inferenceConfig.topP;
    }
    if (
      inferenceConfig.stopSequences !== undefined &&
      parameters.stopSequences === undefined
    ) {
      parameters.stopSequences = inferenceConfig.stopSequences;
    }
  }
  return { family: InvocationFamily.AWS_BEDROCK, parameters };
}

function passthroughAnthropic(
  record: AnthropicInvocationParametersRecord
): AnthropicInvocationParametersRecord {
  return record;
}

function passthroughGoogle(
  record: GoogleInvocationParametersRecord
): GoogleInvocationParametersRecord {
  return record;
}

/**
 * Transforms a raw bridge record (pre-canonicalization, may carry legacy /
 * alternate wire shapes) into a canonical bridge record consumable by the
 * writer and form-store. Only OpenAI and AWS have actual collapses; Anthropic
 * and Google share the same type for both states and pass through.
 */
export function canonicalizeInvocationParameters(
  record: RawPromptInvocationParametersRecord,
  options: CanonicalizeInvocationParametersOptions = {}
): PromptInvocationParametersRecord {
  switch (record.family) {
    case InvocationFamily.OPENAI:
      return canonicalizeOpenAI(record, options.openaiApiType ?? null);
    case InvocationFamily.ANTHROPIC:
      return passthroughAnthropic(record);
    case InvocationFamily.GOOGLE_GENAI:
      return passthroughGoogle(record);
    case InvocationFamily.AWS_BEDROCK:
      return canonicalizeAws(record);
    default:
      return assertUnreachable(record);
  }
}
