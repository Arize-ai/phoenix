import { isStringKeyedObject } from "@phoenix/typeUtils";

import { formatContentAsString, safelyParseJSON } from "./jsonUtils";

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
  // A JSON-encoded string previews as what it encodes: the quotes and escapes
  // are how the value travelled, not part of the message. Tool results and
  // playground tool-role messages both arrive this way, and an encoded empty
  // string has to read as empty rather than as a pair of quote marks.
  let subject = content;
  if (
    typeof content === "string" &&
    content.startsWith('"') &&
    content.endsWith('"')
  ) {
    const parsed = safelyParseJSON(content);
    if (typeof parsed.json === "string") {
      subject = parsed.json;
    }
  }
  const text = formatContentAsString(subject, { unquotePlainString: true });
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  let cut = text.slice(0, maxLength);
  // Never end on the leading half of a surrogate pair — an emoji split down the
  // middle renders as a replacement glyph rather than as nothing
  if (/[\uD800-\uDBFF]$/.test(cut)) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
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
 * A one-line excerpt of a flat record — invocation parameters, say — read as
 * `key: value` pairs rather than as the JSON it arrives in. Braces and quotes
 * cost most of a header's width without telling the reader anything, so
 * dropping them fits noticeably more of the record on the line.
 *
 * Falls back to a plain content preview for anything that is not a record, so a
 * caller does not have to know the shape before asking.
 */
export function toRecordPreview(
  content: unknown,
  { maxLength = DEFAULT_MAX_PREVIEW_LENGTH }: { maxLength?: number } = {}
): string | undefined {
  const parsed =
    typeof content === "string" ? safelyParseJSON(content).json : content;
  if (!isStringKeyedObject(parsed) || Array.isArray(parsed)) {
    return toContentPreview(content, { maxLength });
  }
  const entries = Object.entries(parsed).map(
    ([key, value]) => `${key}: ${value === null ? "null" : toSingleLine(value)}`
  );
  if (entries.length === 0) {
    return undefined;
  }
  return truncate(entries.join(", "), maxLength);
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
