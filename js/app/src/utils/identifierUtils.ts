import type { ValidateResult } from "react-hook-form";

import {
  ALLOWED_IDENTIFIER_CHARACTERS_PATTERN,
  IDENTIFIER_ERROR_MESSAGES,
  LEADING_AND_TRAILING_ALPHANUMERIC_CHARACTERS_PATTERN,
} from "@phoenix/constants";

import { removeDiacritics } from "./textTransformUtils";

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
  if (!ALLOWED_IDENTIFIER_CHARACTERS_PATTERN.test(value)) {
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
  if (!LEADING_AND_TRAILING_ALPHANUMERIC_CHARACTERS_PATTERN.test(value)) {
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
 * Collapses each run of whitespace in `value` into a single dash, leaving all
 * other characters untouched so validation can still flag them.
 *
 * Use this as a controlled-input transformer when only spaces should be
 * converted; to also lowercase and strip disallowed characters, use
 * {@link transformIdentifierInput}.
 */
export function replaceWhitespaceWithDashes(value: string): string {
  return value.replace(/\s+/g, "-");
}

/**
 * Lowercases `value`, folds accented letters to their base letter, drops any
 * character outside the allowed identifier set, and collapses whitespace runs
 * into single dashes. Leading separators are
 * discarded because they can never form a valid identifier. Trailing
 * separators are preserved so the caller can keep typing (e.g. typing "foo "
 * should yield "foo-" without the dash being stripped mid-edit and jumping
 * the cursor).
 *
 * Use this as a controlled-input transformer; for one-shot conversion of an
 * arbitrary string into a final identifier, use {@link getIdentifier}.
 */
export function transformIdentifierInput(value: string): string {
  return replaceWhitespaceWithDashes(
    removeDiacritics(value)
      .toLowerCase()
      .replace(/[^_a-z0-9\s-]/g, "")
  ).replace(/^[_-]+/, "");
}

/**
 * Removes leading and trailing dashes and underscores so an identifier starts
 * and ends with a letter or digit. Apply it once the user stops editing (e.g.
 * on blur); {@link transformIdentifierInput} keeps trailing separators while
 * typing.
 */
export function trimIdentifierSeparators(value: string): string {
  return value.replace(/^[_-]+|[_-]+$/g, "");
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
  return trimIdentifierSeparators(transformIdentifierInput(value));
}
