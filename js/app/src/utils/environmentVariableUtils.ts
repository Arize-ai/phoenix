import { removeDiacritics } from "./textTransformUtils";

/**
 * Converts user input to conventional environment-variable form. Accented
 * letters are folded to their base letter, unsupported characters are
 * removed, and common human-readable separators become underscores. Leading
 * underscores are dropped because a key must start with a letter. A leading
 * digit is intentionally preserved so validation can flag it without silently
 * changing the key's meaning. Trailing underscores are kept so the user can
 * keep typing; use {@link trimEnvironmentVariableSeparators} once editing
 * stops.
 */
export function transformEnvironmentVariableInput(value: string): string {
  return removeDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_.\s-]/g, "")
    .replace(/[.\s-]+/g, "_")
    .replace(/^_+/, "");
}

/**
 * Like {@link transformEnvironmentVariableInput}, but keeps letter case and
 * leading underscores. For places such as sandbox environment variables, where
 * names are case-sensitive and lowercase or underscore-prefixed names (e.g.
 * `http_proxy`, `_JAVA_OPTIONS`) are valid.
 */
export function transformCasePreservingEnvironmentVariableInput(
  value: string
): string {
  return removeDiacritics(value)
    .replace(/[^A-Za-z0-9_.\s-]/g, "")
    .replace(/[.\s-]+/g, "_");
}

/**
 * Removes leading and trailing underscores so an environment-variable key
 * starts and ends with a letter or digit.
 */
export function trimEnvironmentVariableSeparators(value: string): string {
  return value.replace(/^_+|_+$/g, "");
}
