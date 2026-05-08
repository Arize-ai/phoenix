/**
 * Reverse translators: recorded span attributes (`llm.invocation_parameters`) →
 * family-discriminated bridge record.
 */

import type { InvocationFamily } from "./invocationParameterSpecs";
import {
  emptyRawPromptInvocationParametersRecord,
  INVOCATION_PARAMETERS_SCHEMA_BY_FAMILY,
  type RawPromptInvocationParametersRecord,
} from "./promptInvocationParameterCodecs";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Single snake_case → camelCase normalization point for span attribute JSON.
 * Per-field `.catch(undefined)` in the family schemas drops malformed values
 * field-by-field; an unparseable payload returns an empty record.
 */
export function normalizeSpanInvocationParameters(
  raw: unknown,
  family: InvocationFamily
): RawPromptInvocationParametersRecord {
  if (!isPlainObject(raw))
    return emptyRawPromptInvocationParametersRecord(family);
  const parsed = INVOCATION_PARAMETERS_SCHEMA_BY_FAMILY[family].safeParse(raw);
  return parsed.success
    ? parsed.data
    : emptyRawPromptInvocationParametersRecord(family);
}

/**
 * Best-effort OpenAI API classification from recorded invocation parameter keys.
 *
 * Returns `null` when the parameter bag carries no API-distinguishing signal
 * (generic keys only, unparseable payload, or empty), letting the caller
 * combine this with other heuristics (e.g. {@link isOpenAIResponsesSpan})
 * before falling back to a configured default.
 */
export function inferOpenAIApiTypeFromAttributes(
  invocationParameters: unknown
): OpenAIApiType | null {
  let raw: Record<string, unknown> | null = null;
  if (typeof invocationParameters === "string") {
    try {
      raw = JSON.parse(invocationParameters) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (isPlainObject(invocationParameters)) {
    raw = invocationParameters;
  }
  if (!raw) {
    return null;
  }
  const keys = new Set(Object.keys(raw));

  const responsesSignals =
    keys.has("max_output_tokens") ||
    keys.has("instructions") ||
    keys.has("previous_response_id") ||
    (isPlainObject(raw.reasoning) && !keys.has("reasoning_effort"));

  if (responsesSignals) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[inferOpenAIApiTypeFromAttributes]", {
        keys: [...keys],
        chosen: "RESPONSES",
        rule: "responses-leaning",
      });
    }
    return "RESPONSES";
  }

  const chatSignals =
    keys.has("max_completion_tokens") ||
    keys.has("stop") ||
    keys.has("frequency_penalty") ||
    keys.has("presence_penalty");

  if (chatSignals) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[inferOpenAIApiTypeFromAttributes]", {
        keys: [...keys],
        chosen: "CHAT_COMPLETIONS",
        rule: "chat-leaning",
      });
    }
    return "CHAT_COMPLETIONS";
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[inferOpenAIApiTypeFromAttributes]", {
      keys: [...keys],
      chosen: null,
      rule: "no-signal",
    });
  }
  return null;
}
