import { useMemo } from "react";

import {
  extractAssistantContent,
  parseChatMessageOutput,
} from "@phoenix/schemas/experimentOutputSchemas";

import { useUnnestedValue } from "./useUnnestedValue";

/**
 * Hook that extracts the renderable content from an experiment output.
 *
 * Supports two formats:
 * 1. Chat message format: `{ messages: [{ role: "assistant", content: "..." }] }`
 * 2. Single-key object: `{ response: "..." }` or `{ output: "..." }`
 *
 * @param value - The experiment output value to analyze
 * @returns The extracted string content, or the original value when neither
 * format matches
 *
 * @example
 * const content = useExtractedOutputContent(output);
 * return <DynamicContent value={content} />;
 */
export function useExtractedOutputContent<T>(value: T): string | T {
  // Parse both formats upfront (hooks must be called unconditionally)
  const chatOutput = useMemo(() => parseChatMessageOutput(value), [value]);
  const { value: unnestedValue, wasUnnested } = useUnnestedValue(value);

  // Try chat message format first
  if (chatOutput) {
    const assistantContent = extractAssistantContent(chatOutput);
    if (assistantContent !== null) {
      return assistantContent;
    }
  }

  // Try single-key object format (e.g., { "response": "..." })
  // useUnnestedValue returns wasUnnested: true if it was a single-key object with string value
  if (wasUnnested) {
    return unnestedValue;
  }

  // Fall back to original value
  return value;
}
