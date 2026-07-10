/** Maximum character length for model names in chart axis labels. */
export const MAX_MODEL_NAME_LENGTH = 14;

/**
 * Truncates a model name if it exceeds the maximum length.
 * Uses ellipsis at the end.
 */
export function truncateModelName(value: unknown): string {
  if (typeof value !== "string") {
    return String(value);
  }
  if (value.length <= MAX_MODEL_NAME_LENGTH) {
    return value;
  }
  return value.slice(0, MAX_MODEL_NAME_LENGTH) + "...";
}
