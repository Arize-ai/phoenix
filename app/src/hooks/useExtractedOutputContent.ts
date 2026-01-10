import { useMemo } from "react";

import {
  extractAssistantContent,
  parseChatMessageOutput,
} from "@phoenix/schemas/experimentOutputSchemas";

import { useUnnestedValue } from "./useUnnestedValue";

/**
 * Discriminated union for extracted output content.
 * When `isExtracted` is true, `content` is guaranteed to be a string.
 * When `isExtracted` is false, `content` is the original value type.
 */
export type ExtractedOutputContent<T> =
  | {
      /** Content was successfully extracted as a renderable string */
      isExtracted: true;
      /** The extracted string content */
      content: string;
    }
  | {
      /** Content could not be extracted, returning original value */
      isExtracted: false;
      /** The original value, unchanged */
      content: T;
    };

/**
 * Hook that attempts to extract renderable string content from experiment outputs.
 *
 * Supports two formats:
 * 1. Chat message format: `{ messages: [{ role: "assistant", content: "..." }] }`
 * 2. Single-key object: `{ response: "..." }` or `{ output: "..." }`
 *
 * @param value - The experiment output value to analyze
 * @returns Discriminated union - when `isExtracted` is true, `content` is a string
 *
 * @example
 * const result = useExtractedOutputContent(output);
 * if (result.isExtracted) {
 *   // TypeScript knows content is string here
 *   return <MarkdownBlock>{result.content}</MarkdownBlock>;
 * }
 * // TypeScript knows content is the original type here
 * return <DynamicContent value={result.content} />;
 */
export function useExtractedOutputContent<T>(
  value: T
): ExtractedOutputContent<T> {
  // Parse both formats upfront (hooks must be called unconditionally)
  const chatOutput = useMemo(() => parseChatMessageOutput(value), [value]);
  const { value: unnestedValue, wasUnnested } = useUnnestedValue(value);

  // Try chat message format first
  if (chatOutput) {
    const assistantContent = extractAssistantContent(chatOutput);
    if (assistantContent !== null) {
      return {
        isExtracted: true,
        content: assistantContent,
      };
    }
  }

  // Try single-key object format (e.g., { "response": "..." })
  // useUnnestedValue returns wasUnnested: true if it was a single-key object with string value
  if (wasUnnested) {
    return {
      isExtracted: true,
      content: unnestedValue,
    };
  }

  // Fall back to original value
  return {
    isExtracted: false,
    content: value,
  };
}
