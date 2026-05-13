/**
 * Best-effort OpenAI API classification from recorded span attributes.
 * Standalone helper — span → canonical config goes through the provider
 * adapter dispatcher's `spanInvocationToConfigAndPromoted` instead.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
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
