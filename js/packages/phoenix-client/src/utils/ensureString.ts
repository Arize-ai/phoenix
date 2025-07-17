import { safelyStringifyJSON } from "./safelyStringifyJSON";

/**
 * Ensures that a value is a string.
 * If the value is not a string, it will be converted to a string using `safelyStringifyJSON`.
 * @param value - The value to ensure is a string.
 * @returns The value as a string.
 */
export function ensureString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return safelyStringifyJSON(value)?.json ?? "";
}
