/** Per-string character cap for user-controlled body fields returned to the model. */
export const MAX_BODY_FIELD_CHARS = 4000;

/** Sentinel appended to a truncated string, mirroring the server sanitize marker. */
export const TRUNCATION_MARKER = "… [truncated]";

function truncateString(value: string): string {
  return value.length > MAX_BODY_FIELD_CHARS
    ? `${value.slice(0, MAX_BODY_FIELD_CHARS)}${TRUNCATION_MARKER}`
    : value;
}

/** Evaluator bodies bypass the server `| sanitize` filter, so the cap is applied client-side. */
export function truncateStringLeaves<Value>(value: Value): Value {
  if (typeof value === "string") {
    return truncateString(value) as Value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateStringLeaves(item)) as Value;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        truncateStringLeaves(item),
      ])
    ) as Value;
  }
  return value;
}
