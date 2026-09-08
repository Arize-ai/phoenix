import { useMemo } from "react";

/**
 * The local timezone's offset in minutes from UTC. Note: this inverts the
 * sign of getTimezoneOffset() (which reports how far the timezone is *behind*
 * UTC, e.g. 300 for EST) to align with how the server expects the offset.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
 */
export function getUTCOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * A react hook that returns a memoized value of the offset in minutes from UTC.
 * Note: this inverts the offset sign to align with how the server expects the offset
 */
export function useUTCOffsetMinutes() {
  return useMemo(() => getUTCOffsetMinutes(), []);
}
