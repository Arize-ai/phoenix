import { formatContentAsString } from "./jsonUtils";

/**
 * How much of the content a preview keeps. Long enough that a reader can tell
 * two messages apart, short enough that the browser is not laying out a whole
 * system prompt to then clip it to one header's width.
 */
const DEFAULT_MAX_PREVIEW_LENGTH = 200;

/**
 * Content flattened onto the single line a preview is rendered on. Newlines and
 * runs of whitespace collapse to single spaces. Not truncated — callers that
 * compose several of these have to truncate the composed result, not its parts.
 */
function toSingleLine(content: unknown): string {
  if (content == null) {
    return "";
  }
  const text = formatContentAsString(content, { unquotePlainString: true });
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/**
 * A one-line excerpt of some content, for a card that has been collapsed and so
 * would otherwise say only what kind of thing it holds.
 *
 * Returns `undefined` when there is nothing worth showing, so a caller can fall
 * back to another part of the content (tool calls, say) rather than render an
 * empty preview.
 */
export function toContentPreview(
  content: unknown,
  { maxLength = DEFAULT_MAX_PREVIEW_LENGTH }: { maxLength?: number } = {}
): string | undefined {
  const singleLine = toSingleLine(content);
  if (singleLine === "") {
    return undefined;
  }
  return truncate(singleLine, maxLength);
}

/**
 * The preview text for a message whose visible content is a tool call — an
 * assistant turn that only calls tools has nothing else to show.
 *
 * Rendered as `name(arguments)`, the same shape the expanded card shows, since
 * two calls to the same tool are told apart by what they were called with.
 */
export function toToolCallsPreview(
  toolCalls: ReadonlyArray<{ name?: string | null; arguments?: unknown }>,
  { maxLength = DEFAULT_MAX_PREVIEW_LENGTH }: { maxLength?: number } = {}
): string | undefined {
  const calls = toolCalls
    .filter((toolCall) => toolCall.name)
    .map((toolCall) => `${toolCall.name}(${toSingleLine(toolCall.arguments)})`);
  if (calls.length === 0) {
    return undefined;
  }
  return truncate(calls.join(", "), maxLength);
}
