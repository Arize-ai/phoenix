import { removeDiacritics } from "./textTransformUtils";

/**
 * Converts whitespace to dashes and removes characters that are not accepted
 * by Phoenix's URI-safe project-name fields. Accented letters are folded to
 * their base letter, and letter case is preserved. Leading separators are
 * dropped because a name must start with a letter or digit. Trailing
 * separators are kept so the user can keep typing; use
 * {@link trimURISafeSeparators} once editing stops.
 */
export function transformURISafeInput(value: string): string {
  return removeDiacritics(value)
    .replace(/[^a-zA-Z0-9._\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[._-]+/, "");
}

/**
 * Removes leading and trailing separators (dots, dashes, underscores) from a
 * URI-safe name so it starts and ends with a letter or digit.
 */
export function trimURISafeSeparators(value: string): string {
  return value.replace(/^[._-]+|[._-]+$/g, "");
}
