/** Maximum character length for model names in chart axis labels. */
export const MAX_MODEL_NAME_LENGTH = 14;

/**
 * Truncates text to at most `maxLength` characters, replacing the tail with
 * an ellipsis when it exceeds the limit. Intended for chart axis tick labels
 * where recharts can't ellipsize via CSS.
 */
export function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

/**
 * Truncates a model name if it exceeds the maximum length.
 * Uses ellipsis at the end.
 */
export function truncateModelName(value: unknown): string {
  if (typeof value !== "string") {
    return String(value);
  }
  return truncateText(value, MAX_MODEL_NAME_LENGTH);
}
