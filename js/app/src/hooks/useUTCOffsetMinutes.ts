import { useMemo } from "react";

/**
 * A react hook that returns a memoized value of the offset in minutes from UTC.
 * Note: this inverts the offset sign to align with how the server expects the offset
 */
export function useUTCOffsetMinutes() {
  return useMemo(() => {
    // Note: getTimezoneOffset() returns the offset in minutes that the timezone is behind UTC
    // For example, if you're in EST (UTC-5), it returns 300 (5 hours * 60 minutes)
    // Since we need the offset FROM UTC, we negate this value
    // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    return -new Date().getTimezoneOffset();
  }, []);
}
