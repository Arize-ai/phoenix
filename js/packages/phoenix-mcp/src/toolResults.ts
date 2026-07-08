/**
 * Wrap an arbitrary payload as a JSON-formatted MCP text content response.
 *
 * @param payload - The value to serialize. Will be pretty-printed with 2-space indentation.
 * @returns An MCP tool result containing one text content block.
 */
export function jsonResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Wrap a plain string as an MCP text content response.
 *
 * @param text - The plain text to return.
 * @returns An MCP tool result containing one text content block.
 */
export function textResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}
