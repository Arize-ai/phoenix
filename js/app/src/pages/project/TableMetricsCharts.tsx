import { memo, type ReactNode } from "react";

import { useTimeRange } from "@phoenix/components";
import {
  ChartPanelStrip,
  MetricChartsPanelGroup,
} from "@phoenix/components/chart";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { MetricChartTableView } from "./constants";
import {
  DeferredProjectMetricPanel,
  getProjectMetricCharts,
} from "./metrics/chartCatalog";
import { MetricFetchKeyProvider } from "./metrics/types";
import { useClosedTimeRange } from "./metrics/useClosedTimeRange";

/**
 * A strip of user-selected metric charts shown above a project table (spans,
 * traces, or sessions) for troubleshooting. Any chart in the chart catalog
 * can be added. Charts support legend-based series filtering, and most
 * support click-to-narrow and drag-to-select time range zooming, with browser
 * Back restoring the prior range. The chart selection is persisted per project
 * and per table view.
 */
const TableMetricsCharts = memo(function TableMetricsCharts({
  view,
}: {
  view: MetricChartTableView;
}) {
  const projectId = useTracingContext((state) => state.projectId);
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const { setCustomTimeRange } = useTimeRange();
  const { fetchKey } = useStreamState();
  const timeRange = useClosedTimeRange();
  const charts = getProjectMetricCharts(selectedChartKeys);
  return (
    <ChartPanelStrip chartCount={charts.length}>
      {/* Re-fetch the charts on each stream refresh so they stay live */}
      <MetricFetchKeyProvider value={fetchKey}>
        {charts.map((chart) => (
          <DeferredProjectMetricPanel
            key={chart.key}
            chart={chart}
            projectId={projectId}
            timeRange={timeRange}
            onTimeRangeSelected={setCustomTimeRange}
            fillHeight
          />
        ))}
      </MetricFetchKeyProvider>
    </ChartPanelStrip>
  );
});

/**
 * Lays out the metric charts strip above a table (filter bar + table) in a
 * vertically resizable panel group. When no charts are selected the table
 * content fills the space.
 */
export function TableMetricsChartsPanelGroup({
  view,
  children,
}: {
  view: MetricChartTableView;
  children: ReactNode;
}) {
  // The store guarantees keys are valid catalog keys, so any selection means
  // there are charts to show
  const hasCharts = useProjectContext(
    (state) => state.metricChartKeys[view].length > 0
  );
  return (
    <MetricChartsPanelGroup
      layoutId={`${view}-table-metrics-layout`}
      charts={hasCharts ? <TableMetricsCharts view={view} /> : null}
    >
      {children}
    </MetricChartsPanelGroup>
  );
}
