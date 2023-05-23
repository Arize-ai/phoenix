import { format } from "d3-format";

type NumberFormatFn = (number: number) => string;
type MaybeNumber = number | null | undefined;
type MaybeNumberFormatFn = (maybeNumber: MaybeNumber) => string;

/**
 * Formats ints cleanly across different sizes.
 * NB: this may not work for every type of int but can be used when you want to display a int
 * without knowing the range of the int
 * @param float
 * @returns {string} the string representation of the int
 */
export function formatInt(int: number): string {
  const absInt = Math.abs(int);
  if (absInt < 1000000) return format(",")(int);
  return format("0.2s")(int);
}

/**
 * Formats floats cleanly across different sizes.
 * NB: this may not work for every type of float but can be used when you want to display a float
 * without knowing the range of the float
 * @param float
 * @returns {string} the string representation of the float
 */
export function formatFloat(float: number): string {
  const absValue = Math.abs(float);
  if (absValue === 0.0) return "0.00";
  else if (absValue < 0.01) return format(".2e")(float);
  else if (absValue < 1000) return format("0.2f")(float);
  return format("0.2s")(float);
}

/**
 * Formats a number to be displayed cleanly across different sizes.
 * NB: this may not work for every type of number but can be used when you want to display a number
 * without knowing the range of the number
 * @param number
 * @returns {string} the string representation of the number
 */
export function formatNumber(number: number): string {
  if (Number.isInteger(number)) return formatInt(number);
  return formatFloat(number);
}

/**
 * A factory function to create a formatter for a number that is tolerant of nulls and undefined values
 * @param {Function} formatFn a format function that takes a number and returns a string
 * @returns {string} textual representation of the value
 */
export function createNumberFormatter(
  formatFn: NumberFormatFn
): MaybeNumberFormatFn {
  return (maybeNumber: MaybeNumber) => {
    if (typeof maybeNumber !== "number") return "--";
    return formatFn(maybeNumber);
  };
}

export const intFormatter = createNumberFormatter(formatInt);
export const floatFormatter = createNumberFormatter(formatFloat);
export const numberFormatter = createNumberFormatter(formatNumber);
