import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { css } from "@emotion/react";

import { useTimeRange, View } from "@phoenix/components";
import { transparentResizeHandleCSS } from "@phoenix/components/resize";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import type { MetricChartTableView } from "./constants";
import { PROJECT_METRIC_CHARTS } from "./metrics/chartCatalog";
import { MetricPanel } from "./metrics/MetricPanel";
import { useClosedTimeRange } from "./metrics/useClosedTimeRange";

const CHARTS_PANEL_DEFAULT_SIZE_PIXELS = 230;
const CHARTS_PANEL_MIN_SIZE_PIXELS = 160;
const CHARTS_PANEL_MAX_SIZE = "60%";

/**
 * Pull the following panel up by the handle's height so the handle adds no
 * layout height of its own — it overlays the top of the table content's
 * padding instead. Keeps the vertical rhythm around the filter bar consistent
 * while preserving the handle's hover/drag hit area.
 */
const chartsResizeHandleCSS = css`
  margin-bottom: calc(-1 * var(--resize-handle-size));
  position: relative;
  z-index: 1;
`;

const chartsGridCSS = css`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  height: 100%;
`;

/**
 * A strip of user-selected metric charts shown above a project table (spans,
 * traces, or sessions) for troubleshooting. Any chart in the chart catalog
 * can be added. Charts support legend-based series filtering, and most
 * support drag-to-select time range zooming. The selection is persisted per
 * project and per table view.
 */
export function TableMetricsCharts({
  projectId,
  view,
}: {
  projectId: string;
  view: MetricChartTableView;
}) {
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const { setCustomTimeRange } = useTimeRange();
  const { fetchKey } = useStreamState();
  // Re-close the time range on each stream refresh so live, open-ended
  // ranges extend to include newly streamed data
  const epochTimeRange = useClosedTimeRange({ refreshKey: fetchKey });
  const charts = PROJECT_METRIC_CHARTS.filter((chart) =>
    selectedChartKeys.includes(chart.key)
  );
  if (charts.length === 0) {
    return null;
  }
  const timeRange = {
    start: new Date(epochTimeRange.start),
    end: new Date(epochTimeRange.end),
  };
  return (
    <View
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-100"
      height="100%"
      overflow="visible"
      position="relative"
      zIndex={2}
    >
      <div css={chartsGridCSS}>
        {charts.map(({ key, name, description, Component }) => (
          <MetricPanel
            key={key}
            title={name}
            subtitle={description}
            chartHeight="fill"
          >
            <Component
              projectId={projectId}
              timeRange={timeRange}
              onTimeRangeSelected={setCustomTimeRange}
              fetchKey={fetchKey}
            />
          </MetricPanel>
        ))}
      </div>
    </View>
  );
}

/**
 * Lays out the metric charts strip above a table in a vertically resizable
 * panel group. A transparent drag handle sits between the charts and the
 * table content (filter bar + table) so the charts can be resized to take up
 * more or less vertical space. When no charts are selected the charts panel
 * and handle are not rendered and the table content fills the space.
 */
export function TableMetricsChartsPanelGroup({
  projectId,
  view,
  children,
}: {
  projectId: string;
  view: MetricChartTableView;
  children: ReactNode;
}) {
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const hasCharts = PROJECT_METRIC_CHARTS.some((chart) =>
    selectedChartKeys.includes(chart.key)
  );
  return (
    <Group orientation="vertical" id={`${view}-table-metrics-layout`}>
      {hasCharts && (
        <>
          <Panel
            id="metrics-charts"
            defaultSize={CHARTS_PANEL_DEFAULT_SIZE_PIXELS}
            minSize={CHARTS_PANEL_MIN_SIZE_PIXELS}
            maxSize={CHARTS_PANEL_MAX_SIZE}
            groupResizeBehavior="preserve-pixel-size"
            style={{ overflow: "visible" }}
          >
            <TableMetricsCharts projectId={projectId} view={view} />
          </Panel>
          <Separator css={[transparentResizeHandleCSS, chartsResizeHandleCSS]} />
        </>
      )}
      <Panel id="table-content">{children}</Panel>
    </Group>
  );
}
