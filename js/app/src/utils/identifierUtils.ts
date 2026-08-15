import type { ValidateResult } from "react-hook-form";

/**
 * Identifier character set: lowercase alphanumerics, dashes, and underscores.
 * The empty string matches so partial input is permitted while a user types.
 */
export const allowedIdentifierCharactersRegex = /^[_a-z0-9-]*$/;

/**
 * Identifiers must begin and end with a lowercase alphanumeric character.
 * The empty string and single alphanumerics are permitted.
 */
export const leadingAndTrailingAlphanumericCharactersRegex =
  /^([a-z0-9](.*[a-z0-9])?)?$/;

/**
 * Human-readable error messages surfaced by the identifier validators below.
 */
export const IDENTIFIER_ERROR_MESSAGES = {
  empty: "Cannot be empty",
  allowedChars:
    "Must have only lowercase alphanumeric characters, dashes, and underscores",
  leadingTrailing: "Must start and end with lowercase alphanumeric characters",
} as const;

/**
 * Checks that `value` is non-empty and only uses the allowed identifier
 * character set. Intended for live (per-keystroke) validation so users see
 * disallowed characters flagged immediately.
 *
 * @returns `true` when valid, otherwise an error message from
 * {@link IDENTIFIER_ERROR_MESSAGES}.
 */
export function validateIdentifierAllowedChars(value: string): ValidateResult {
  if (!value || value.trim() === "") {
    return IDENTIFIER_ERROR_MESSAGES.empty;
  }
  if (!allowedIdentifierCharactersRegex.test(value)) {
    return IDENTIFIER_ERROR_MESSAGES.allowedChars;
  }
  return true;
}

/**
 * Checks that `value` starts and ends with a lowercase alphanumeric character.
 * Intended for deferred (on-blur) validation so users are not nagged about a
 * trailing dash while still typing.
 *
 * @returns `true` when valid, otherwise an error message from
 * {@link IDENTIFIER_ERROR_MESSAGES}.
 */
export function validateIdentifierLeadingTrailing(
  value: string
): ValidateResult {
  if (!leadingAndTrailingAlphanumericCharactersRegex.test(value)) {
    return IDENTIFIER_ERROR_MESSAGES.leadingTrailing;
  }
  return true;
}

/**
 * Runs every identifier rule and returns the first failure. Use this for
 * final form-submission validation where any violation should block submit.
 *
 * @returns `true` when valid, otherwise the first error message encountered.
 */
export function validateIdentifier(value: string): ValidateResult {
  const allowedCharsResult = validateIdentifierAllowedChars(value);
  if (allowedCharsResult !== true) {
    return allowedCharsResult;
  }
  return validateIdentifierLeadingTrailing(value);
}

/**
 * Lowercases `value`, collapses whitespace runs into single dashes, and drops
 * any character outside the allowed identifier set. Leading and trailing
 * separators are preserved so the caller can keep typing (e.g. typing
 * "foo " should yield "foo-" without the dash being stripped mid-edit and
 * jumping the cursor).
 *
 * Use this as a controlled-input transformer; for one-shot conversion of an
 * arbitrary string into a final identifier, use {@link getIdentifier}.
 */
export function transformIdentifierInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^_a-z0-9-]/g, "");
}

/**
 * Converts an arbitrary string into a valid identifier slug: lowercase,
 * with whitespace replaced by dashes, disallowed characters removed, and
 * any leading or trailing dashes/underscores trimmed.
 *
 * Suitable for generating default identifiers from human-readable names
 * (e.g. a display name → a slug). For live input transformation that must
 * preserve cursor position, use {@link transformIdentifierInput}.
 */
export function getIdentifier(value: string): string {
  return transformIdentifierInput(value).replace(/^[_-]+|[_-]+$/g, "");
}
