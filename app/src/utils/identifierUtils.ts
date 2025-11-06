import type { ValidateResult } from "react-hook-form";

const allowedIdentifierCharactersRegex = /^[_a-z0-9-]*$/;
const leadingAndTrailingAlphanumericCharactersRegex =
  /^([a-z0-9](.*[a-z0-9])?)?$/;

export function validateIdentifier(value: string): ValidateResult {
  if (!allowedIdentifierCharactersRegex.test(value)) {
    return "Must have only lowercase alphanumeric characters, dashes, and underscores";
  }
  if (!leadingAndTrailingAlphanumericCharactersRegex.test(value)) {
    return "Must start and end with lowercase alphanumeric characters";
  }
  return true;
}
