import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
  ONE_WEEK_MS,
} from "@phoenix/constants/timeConstants";
import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * Get the half-open time range represented by a chart bin.
 *
 * Minute through week bins need no offset adjustment: the server applies a
 * fixed minute shift rather than a timezone database, so their UTC durations
 * remain fixed. Month and year bins use calendar arithmetic in the same
 * offset-shifted frame as the server.
 *
 * @param params - time bin parameters
 * @param params.binStartMs - bin start in epoch milliseconds
 * @param params.scale - scale used to query the chart data
 * @param params.unitsPerBin - number of `scale` units in each bin
 * @param params.utcOffsetMinutes - fixed UTC offset used to query the chart
 */
export function getTimeBinRange({
  binStartMs,
  scale,
  unitsPerBin = 1,
  utcOffsetMinutes,
}: {
  binStartMs: number;
  scale: TimeBinScale;
  unitsPerBin?: number;
  utcOffsetMinutes: number;
}): TimeRange {
  const start = new Date(binStartMs);
  switch (scale) {
    case "MINUTE":
      return { start, end: new Date(binStartMs + unitsPerBin * ONE_MINUTE_MS) };
    case "HOUR":
      return { start, end: new Date(binStartMs + unitsPerBin * ONE_HOUR_MS) };
    case "DAY":
      return { start, end: new Date(binStartMs + unitsPerBin * ONE_DAY_MS) };
    case "WEEK":
      return { start, end: new Date(binStartMs + unitsPerBin * ONE_WEEK_MS) };
    case "MONTH":
    case "YEAR": {
      const utcOffsetMs = utcOffsetMinutes * ONE_MINUTE_MS;
      const shiftedEnd = new Date(binStartMs + utcOffsetMs);
      if (scale === "MONTH") {
        shiftedEnd.setUTCMonth(shiftedEnd.getUTCMonth() + unitsPerBin);
      } else {
        shiftedEnd.setUTCFullYear(shiftedEnd.getUTCFullYear() + unitsPerBin);
      }
      return {
        start,
        end: new Date(shiftedEnd.getTime() - utcOffsetMs),
      };
    }
    default:
      return assertUnreachable(scale);
  }
}
