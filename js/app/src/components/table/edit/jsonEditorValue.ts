import { EMPTY_JSON_OBJECT_EDITOR_TEXT } from "@phoenix/utils/jsonUtils";

/**
 * The text the cell editor shows for a JSON value.
 */
export function formatJSONEditorValue(value: unknown): string {
  const text = JSON.stringify(value, null, 2) ?? "";
  return text === "{}" ? EMPTY_JSON_OBJECT_EDITOR_TEXT : text;
}

/**
 * Where the cursor starts in freshly opened editor text: inside the first
 * empty string, which is the first blank to fill in, or on the empty line of
 * an empty object. Anything else starts at the top.
 */
export function getJSONEditorInitialCursor(text: string): number {
  const emptyStringIndex = text.indexOf('""');
  if (emptyStringIndex !== -1) {
    return emptyStringIndex + 1;
  }
  if (text === EMPTY_JSON_OBJECT_EDITOR_TEXT) {
    return text.indexOf("\n") + 3;
  }
  return 0;
}
