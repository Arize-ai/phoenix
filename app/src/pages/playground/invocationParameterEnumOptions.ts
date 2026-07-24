import type {
  AnthropicOutputConfigEffort,
  AnthropicThinkingDisplay,
  GoogleThinkingLevel,
  OpenAIReasoningEffort,
} from "./__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";

/**
 * Provider APIs and GraphQL store enum values in uppercase, while SDK users type
 * the same options as lowercase strings (for example, `effort="high"`). The
 * playground uses those SDK-style strings in the form controls, then adapters
 * canonicalize back to provider/GraphQL enum casing at serialization time.
 */
function toLowercaseValues<const TValues extends readonly string[]>(
  values: TValues
): { readonly [TIndex in keyof TValues]: Lowercase<TValues[TIndex]> } {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- map cannot preserve the mapped-tuple type
  return values.map((value) => value.toLowerCase()) as {
    readonly [TIndex in keyof TValues]: Lowercase<TValues[TIndex]>;
  };
}

export const OPENAI_REASONING_EFFORT_VALUES = [
  "NONE",
  "MINIMAL",
  "LOW",
  "MEDIUM",
  "HIGH",
  "XHIGH",
] as const satisfies readonly OpenAIReasoningEffort[];
export const OPENAI_REASONING_EFFORT_FORM_VALUES = toLowercaseValues(
  OPENAI_REASONING_EFFORT_VALUES
);

const OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM: Record<
  OpenAIReasoningEffort,
  string
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- record is exhaustive by construction over all enum values
> = Object.fromEntries(
  OPENAI_REASONING_EFFORT_VALUES.map((value) => [value, value.toLowerCase()])
) as Record<OpenAIReasoningEffort, string>;

function isOpenAIReasoningEffort(
  value: string
): value is OpenAIReasoningEffort {
  return value in OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM;
}

export function parseOpenAIReasoningEffort(
  value: unknown
): OpenAIReasoningEffort | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const canonicalValue = trimmed.toUpperCase();
  if (!isOpenAIReasoningEffort(canonicalValue)) {
    return undefined;
  }
  return canonicalValue;
}

export function toOpenAIReasoningEffortFormValue(
  value: unknown
): string | undefined {
  const canonicalValue = parseOpenAIReasoningEffort(value);
  if (canonicalValue == null) {
    return undefined;
  }
  return OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM[canonicalValue];
}

export const ANTHROPIC_THINKING_TYPE_VALUES = [
  "disabled",
  "enabled",
  "adaptive",
] as const;
export const ANTHROPIC_THINKING_DISPLAY_VALUES = [
  "SUMMARIZED",
  "OMITTED",
] as const satisfies readonly AnthropicThinkingDisplay[];
export const ANTHROPIC_THINKING_DISPLAY_FORM_VALUES = toLowercaseValues(
  ANTHROPIC_THINKING_DISPLAY_VALUES
);
export const ANTHROPIC_OUTPUT_CONFIG_EFFORT_VALUES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "XHIGH",
  "MAX",
] as const satisfies readonly AnthropicOutputConfigEffort[];
export const ANTHROPIC_OUTPUT_CONFIG_EFFORT_FORM_VALUES = toLowercaseValues(
  ANTHROPIC_OUTPUT_CONFIG_EFFORT_VALUES
);

export const GOOGLE_THINKING_LEVEL_VALUES = [
  "MINIMAL",
  "LOW",
  "MEDIUM",
  "HIGH",
] as const satisfies readonly GoogleThinkingLevel[];
export const GOOGLE_THINKING_LEVEL_FORM_VALUES = toLowercaseValues(
  GOOGLE_THINKING_LEVEL_VALUES
);
