export interface ProjectMetricViewProps {
  projectId: string;
  /**
   * The closed time range to query metrics for
   */
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
  /**
   * A Relay fetchKey. Change it to force a refetch, e.g. when new data is streamed in.
   */
  fetchKey?: string;
}

/**
 * Relay query options that make a metric chart query refetch whenever the
 * fetchKey changes (e.g. when new data is streamed in) while continuing to
 * render cached data. Every chart in the chart catalog must pass this to its
 * query so it stays live when shown above the spans table.
 */
export function getMetricQueryFetchOptions(fetchKey: string | undefined) {
  return fetchKey != null
    ? ({ fetchKey, fetchPolicy: "store-and-network" } as const)
    : undefined;
}
