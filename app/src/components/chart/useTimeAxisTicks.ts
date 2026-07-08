import { useMemo } from "react";

import { getTimeAxisTicks } from "./timeTicks";

/**
 * Returns responsive time-axis ticks for chart data.
 * @param params - tick selection parameters
 * @param params.data - chart data containing timestamp values
 * @param params.getTimestamp - extracts an epoch millisecond timestamp from a datum
 * @param params.width - chart width in pixels
 * @param params.minSpacing - minimum spacing between tick labels in pixels
 * @param params.fallbackCount - tick count to use before the chart is measured
 */
export function useTimeAxisTicks<TDatum>({
  data,
  getTimestamp,
  width,
  minSpacing,
  fallbackCount,
}: {
  data: readonly TDatum[];
  getTimestamp: (datum: TDatum) => number;
  width: number | null | undefined;
  minSpacing: number;
  fallbackCount?: number;
}) {
  return useMemo(
    () =>
      getTimeAxisTicks({
        timestamps: data.map(getTimestamp),
        width,
        minSpacing,
        fallbackCount,
      }),
    [data, fallbackCount, getTimestamp, minSpacing, width]
  );
}
