import { formatContentAsString } from "./jsonUtils";

/**
 * How much of the content a preview keeps. Long enough that a reader can tell
 * two messages apart, short enough that the browser is not laying out a whole
 * system prompt to then clip it to one header's width.
 */
const DEFAULT_MAX_PREVIEW_LENGTH = 200;

/**
 * A one-line excerpt of some content, for a card that has been collapsed and so
 * would otherwise say only what kind of thing it holds. Newlines and runs of
 * whitespace collapse to single spaces, since the preview is rendered on a
 * single line; the result is truncated with an ellipsis.
 *
 * Returns `undefined` when there is nothing worth showing, so a caller can fall
 * back to another part of the content (tool calls, say) rather than render an
 * empty preview.
 */
export function toContentPreview(
  content: unknown,
  { maxLength = DEFAULT_MAX_PREVIEW_LENGTH }: { maxLength?: number } = {}
): string | undefined {
  if (content == null) {
    return undefined;
  }
  const text = formatContentAsString(content, { unquotePlainString: true });
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine === "") {
    return undefined;
  }
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength).trimEnd()}…`;
}

/**
 * The preview text for a message whose visible content is a tool call — an
 * assistant turn that only calls tools has nothing else to show, and the tool's
 * name is what distinguishes it from the next such turn.
 */
export function toToolCallsPreview(
  toolCalls: ReadonlyArray<{ name?: string | null }>
): string | undefined {
  const names = toolCalls
    .map((toolCall) => toolCall.name)
    .filter((name): name is string => typeof name === "string" && name !== "");
  if (names.length === 0) {
    return undefined;
  }
  return toContentPreview(names.map((name) => `${name}()`).join(", "));
}
