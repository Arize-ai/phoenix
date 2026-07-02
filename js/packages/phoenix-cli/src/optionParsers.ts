/**
 * Shared Commander option-argument parsers.
 */

/**
 * Commander collector for repeatable string flags. Appends each occurrence to
 * a fresh array so the option's default array is never mutated.
 */
export function collectString(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Parse a numeric option argument strictly. Unlike `parseFloat`, trailing
 * garbage (`"1abc"`) and empty strings do not truncate to a number — they
 * yield `NaN`. Callers must reject non-finite results (`Number.isFinite`)
 * before use so a typo errors instead of silently becoming `null` on the
 * wire.
 */
export function parseNumberOption(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? NaN : Number(trimmed);
}
