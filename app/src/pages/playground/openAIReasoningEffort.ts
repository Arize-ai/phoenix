import type { OpenAIReasoningEffort } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";

export const OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM: Record<
  OpenAIReasoningEffort,
  string
> = {
  NONE: "none",
  MINIMAL: "minimal",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  XHIGH: "xhigh",
};

export const OPENAI_REASONING_EFFORT_ENUM_VALUES = Object.keys(
  OPENAI_REASONING_EFFORT_FORM_VALUE_BY_ENUM
) as OpenAIReasoningEffort[];

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
