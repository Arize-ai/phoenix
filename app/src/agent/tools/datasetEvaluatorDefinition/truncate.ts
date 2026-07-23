/** Per-string character cap for user-controlled body fields returned to the model. */
export const MAX_BODY_FIELD_CHARS = 4000;

/** Sentinel appended to a truncated string, mirroring the server sanitize marker. */
export const TRUNCATION_MARKER = "… [truncated]";

function truncateString(value: string): string {
  return value.length > MAX_BODY_FIELD_CHARS
    ? `${value.slice(0, MAX_BODY_FIELD_CHARS)}${TRUNCATION_MARKER}`
    : value;
}

function truncateLeaves(value: unknown): unknown {
  if (typeof value === "string") {
    return truncateString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateLeaves(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, truncateLeaves(item)])
    );
  }
  return value;
}

/** Evaluator bodies bypass the server `| sanitize` filter, so the cap is applied client-side. */
export function truncateStringLeaves<T>(value: T): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- structure-preserving deep map: only string leaves are rewritten, so the shape still matches T
  return truncateLeaves(value) as T;
}
