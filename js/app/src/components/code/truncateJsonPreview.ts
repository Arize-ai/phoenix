/**
 * How much pretty-printed JSON a collapsed field cell renders. A production
 * span's context can run to hundreds of kilobytes per field, and a table of
 * twenty rows renders sixty of them at once; the cell only ever shows the
 * first screenful, so the rest is rendered on demand by the view popover.
 */
export const JSON_PREVIEW_MAX_CHARS = 4_000;

export type JsonPreview = {
  text: string;
  isTruncated: boolean;
};

/** The start of `json`, cut at a line break, with a note about what is left. */
export function truncateJsonPreview(
  json: string,
  maxChars: number = JSON_PREVIEW_MAX_CHARS
): JsonPreview {
  if (json.length <= maxChars) return { text: json, isTruncated: false };

  const head = json.slice(0, maxChars);
  const lastBreak = head.lastIndexOf("\n");
  // Prefer a whole line, unless the document is one huge line (a long string
  // value), where cutting at the previous break would show almost nothing.
  const kept = lastBreak >= maxChars / 2 ? head.slice(0, lastBreak) : head;
  const omitted = json.length - kept.length;

  return {
    text: `${kept}\n… ${omitted.toLocaleString()} more characters. Open the view to see everything.`,
    isTruncated: true,
  };
}
