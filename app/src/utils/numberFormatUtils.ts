import { format } from "d3-format";

import {
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
  ONE_SECOND_MS,
} from "@phoenix/constants/timeConstants";

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
  return format("0.2s")(int).replace("G", "B").replace("k", "K");
}

/**
 * Formats ints in a short format.
 * @param int
 * @returns {string} the string representation of the int
 */
export function formatIntShort(int: number): string {
  return format("0.2s")(int).replace("G", "B").replace("k", "K");
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
  else if (absValue < 1) {
    // truncate instead of rounding to avoid displaying misleading values for averages
    // and draw attention to outliers (e.g. showing "0.99" instead of "1.00" when the actual value is 0.9999)
    const truncatedFloat = truncate(float, 2);
    return format("0.2f")(truncatedFloat);
  } else if (absValue < 1000) return format("0.2f")(float);
  return format("0.2s")(float);
}

export function formatFloatShort(float: number): string {
  const absValue = Math.abs(float);
  if (absValue === 0.0) return "0.00";
  else if (absValue < 0.01) return format(".2e")(float);
  else if (absValue < 1000) return format("0.2f")(float);
  return format("0.2s")(float).replace("G", "B").replace("k", "K");
}

export function formatPercent(float: number): string {
  return format(".2f")(float) + "%";
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
 * Formats a cost value in dollars.
 * Provides special handling for small and zero costs.
 * @param cost The cost value in dollars
 * @returns {string} The formatted cost string with dollar sign
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return "$0";
  }
  if (cost < 0.01) {
    return "<$0.01";
  }
  // Show 2 decimal places for small costs under 100
  if (cost < 100) return `$${format("0.2f")(cost)}`;
  if (cost < 10000) return `$${format(",")(cost)}`;
  return `$${format("0.2s")(cost).replace("G", "B").replace("k", "K")}`;
}

/**
 * Formats a latency (given in milliseconds) to be displayed across different scales.
 * @param number
 * @returns {string} the string representation of the number
 */
export function formatLatencyMs(number: number): string {
  const hours = Math.floor(number / ONE_HOUR_MS);
  const minutes = Math.floor((number % ONE_HOUR_MS) / ONE_MINUTE_MS);
  const seconds = Math.floor((number % ONE_MINUTE_MS) / ONE_SECOND_MS);
  const milliseconds = Math.floor(number % ONE_SECOND_MS);

  if (hours > 0) {
    return `${hours}h${minutes ? ` ${minutes}m` : ""}${seconds ? ` ${seconds}s` : ""}`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds ? ` ${seconds}s` : ""}`;
  }
  if (seconds > 0) {
    const tenthSeconds = Math.floor(milliseconds / 100);
    return `${seconds}${tenthSeconds > 0 ? `.${tenthSeconds.toFixed(0)}` : ""}s`;
  }
  return `${milliseconds.toFixed(0)}ms`;
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
export const intShortFormatter = createNumberFormatter(formatIntShort);
export const floatShortFormatter = createNumberFormatter(formatFloatShort);
export const floatFormatter = createNumberFormatter(formatFloat);
export const numberFormatter = createNumberFormatter(formatNumber);
export const percentFormatter = createNumberFormatter(formatPercent);
export const costFormatter = createNumberFormatter(formatCost);
export const latencyMsFormatter = createNumberFormatter(formatLatencyMs);

/**
 * Truncates a number to a given precision.
 * e.g. truncate(0.9999, 2) => 0.99
 * @param number
 * @param precision
 * @returns {number} the truncated number
 */
function truncate(number: number, precision: number): number {
  const parts = number.toString().split(".");
  if (parts.length < 2) {
    return number;
  }
  return Number(parts[0] + "." + parts[1].substring(0, precision));
}
