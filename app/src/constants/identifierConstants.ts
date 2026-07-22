/**
 * Identifier character set: lowercase alphanumerics, dashes, and underscores.
 * The empty string matches so partial input is permitted while a user types.
 */
export const ALLOWED_IDENTIFIER_CHARACTERS_PATTERN = /^[_a-z0-9-]*$/;

/**
 * Identifiers must begin and end with a lowercase alphanumeric character.
 * The empty string and single alphanumerics are permitted.
 */
export const LEADING_AND_TRAILING_ALPHANUMERIC_CHARACTERS_PATTERN =
  /^([a-z0-9](.*[a-z0-9])?)?$/;

/** Canonical help text for every user-editable Phoenix identifier field. */
export const IDENTIFIER_DESCRIPTION =
  "Lowercase letters, digits, dashes, and underscores. Must start and end with a letter or digit.";

/** Human-readable errors surfaced by the shared identifier validators. */
export const IDENTIFIER_ERROR_MESSAGES = {
  empty: "Cannot be empty",
  allowedChars:
    "Must have only lowercase alphanumeric characters, dashes, and underscores",
  leadingTrailing: "Must start and end with lowercase alphanumeric characters",
} as const;
