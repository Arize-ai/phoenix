import { useMemo } from "react";

/** The GraphQL `TimeRange` input variable shape. */
export type TimeRangeGraphQLVariable = {
  start: string | undefined;
  end: string | undefined;
};

/** Converts the active time range into a stable GraphQL input variable. */
export function useTimeRangeGraphQLVariable(
  timeRange: OpenTimeRange
): TimeRangeGraphQLVariable {
  const start = timeRange.start?.toISOString();
  const end = timeRange.end?.toISOString();
  return useMemo(() => ({ start, end }), [start, end]);
}
