import type { ValidateResult } from "react-hook-form";

export const allowedIdentifierCharactersRegex = /^[_a-z0-9-]*$/;
export const leadingAndTrailingAlphanumericCharactersRegex =
  /^([a-z0-9](.*[a-z0-9])?)?$/;

export const IDENTIFIER_ERROR_MESSAGES = {
  empty: "Cannot be empty",
  allowedChars:
    "Must have only lowercase alphanumeric characters, dashes, and underscores",
  leadingTrailing: "Must start and end with lowercase alphanumeric characters",
} as const;

/**
 * Validates that identifier is not empty and contains only allowed characters.
 * Used for immediate validation feedback while typing.
 */
export function validateIdentifierAllowedChars(value: string): ValidateResult {
  if (value.trim() === "") {
    return IDENTIFIER_ERROR_MESSAGES.empty;
  }
  if (!allowedIdentifierCharactersRegex.test(value)) {
    return IDENTIFIER_ERROR_MESSAGES.allowedChars;
  }
  return true;
}

/**
 * Validates that identifier starts and ends with alphanumeric characters.
 * Used for deferred validation feedback on blur.
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
 * Full identifier validation combining all checks.
 */
export function validateIdentifier(value: string): ValidateResult {
  const allowedCharsResult = validateIdentifierAllowedChars(value);
  if (allowedCharsResult !== true) {
    return allowedCharsResult;
  }
  return validateIdentifierLeadingTrailing(value);
}
