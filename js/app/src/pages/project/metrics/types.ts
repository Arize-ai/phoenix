import { createContext, useContext } from "react";

import { useFrozenWhileHidden } from "@phoenix/hooks/useFrozenWhileHidden";

/**
 * Recharts syncId shared by every project metric chart so tooltip hover and
 * brush interactions stay synchronized across chart panels. Every chart in
 * the chart catalog must pass this to its chart container.
 */
export const PROJECT_METRICS_CHART_SYNC_ID = "projectMetrics";

export interface ProjectMetricViewProps {
  projectId: string;
  /**
   * The closed time range to query metrics for
   */
  timeRange: TimeRange;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
}

/**
 * A Relay fetchKey for the metric chart queries. Containers that want their
 * charts to refetch when new data is streamed in (e.g. the strip of charts
 * above the spans table) provide it; elsewhere it is undefined and queries
 * fetch once.
 */
const MetricFetchKeyContext = createContext<string | undefined>(undefined);

export const MetricFetchKeyProvider = MetricFetchKeyContext.Provider;

/**
 * Relay query options that make a metric chart query refetch whenever the
 * provided fetchKey changes (e.g. when new data is streamed in) while
 * continuing to render cached data. Every chart in the chart catalog must
 * pass this to its query so it stays live when shown above the spans table.
 *
 * The fetchKey is frozen while the chart is out of view, so stream refreshes
 * only refetch visible charts (see {@link useFrozenWhileHidden}).
 */
export function useMetricQueryFetchOptions() {
  const visibleFetchKey = useFrozenWhileHidden(
    useContext(MetricFetchKeyContext)
  );
  return visibleFetchKey != null
    ? ({ fetchKey: visibleFetchKey, fetchPolicy: "store-and-network" } as const)
    : undefined;
}
