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

/**
 * Parse an option argument as a positive integer (≥ 1), yielding `NaN` for
 * anything else — a float, a zero, a negative, or a typo — so a value that
 * would stall a worker pool never reaches it.
 *
 * The rejection is left to the caller rather than thrown from here: throwing
 * Commander's own `InvalidArgumentError` would exit 1 with a bare line on
 * stderr, where every other bad flag in this CLI exits `INVALID_ARGUMENT` (3)
 * and, under `--format json|raw`, writes the `{error, code, hint}` envelope.
 * Commands reject the `NaN` on their own error path.
 */
export function parsePositiveIntOption(value: string): number {
  const parsed = parseNumberOption(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : NaN;
}
