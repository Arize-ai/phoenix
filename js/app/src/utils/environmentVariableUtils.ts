/**
 * Converts user input to conventional environment-variable form. Common
 * human-readable separators become underscores and unsupported characters are
 * removed. A leading digit is intentionally preserved so validation can flag
 * it without silently changing the key's meaning.
 */
export function transformEnvironmentVariableInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[.\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}
