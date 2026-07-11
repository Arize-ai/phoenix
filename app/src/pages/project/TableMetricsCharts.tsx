import { css } from "@emotion/react";
import { memo, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { useTimeRange, View } from "@phoenix/components";
import { ChartPanel } from "@phoenix/components/chart";
import { transparentResizeHandleCSS } from "@phoenix/components/resize";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { MetricChartTableView } from "./constants";
import { getProjectMetricCharts } from "./metrics/chartCatalog";
import { MetricFetchKeyProvider } from "./metrics/types";
import { useClosedTimeRange } from "./metrics/useClosedTimeRange";

const CHARTS_PANEL_DEFAULT_SIZE_PIXELS = 230;
const CHARTS_PANEL_MIN_SIZE_PIXELS = 160;
const CHARTS_PANEL_MAX_SIZE = "60%";

const PANEL_IDS_WITH_CHARTS = ["metrics-charts", "table-content"];
const PANEL_IDS_WITHOUT_CHARTS = ["table-content"];

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
  // Re-close the time range on each stream refresh so live, open-ended
  // ranges extend to include newly streamed data
  const timeRange = useClosedTimeRange({ refreshKey: fetchKey });
  const charts = getProjectMetricCharts(selectedChartKeys);
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
        {/* Re-fetch the charts on each stream refresh so they stay live */}
        <MetricFetchKeyProvider value={fetchKey}>
          {charts.map(({ key, name, description, Component }) => (
            <ChartPanel
              key={key}
              title={name}
              subtitle={description}
              fillHeight
            >
              <Component
                projectId={projectId}
                timeRange={timeRange}
                onTimeRangeSelected={setCustomTimeRange}
              />
            </ChartPanel>
          ))}
        </MetricFetchKeyProvider>
      </div>
    </View>
  );
});

/**
 * Lays out the metric charts strip above a table in a vertically resizable
 * panel group. A transparent drag handle sits between the charts and the
 * table content (filter bar + table) so the charts can be resized to take up
 * more or less vertical space. When no charts are selected the charts panel
 * and handle are not rendered and the table content fills the space.
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
  // Persist the layout so the charts strip keeps its height across reloads
  // and remounts (e.g. table refetches) instead of resetting to the default
  const layoutId = `${view}-table-metrics-layout`;
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: layoutId,
    panelIds: hasCharts ? PANEL_IDS_WITH_CHARTS : PANEL_IDS_WITHOUT_CHARTS,
    storage: localStorage,
  });
  return (
    <Group
      orientation="vertical"
      id={layoutId}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
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
            <TableMetricsCharts view={view} />
          </Panel>
          <Separator
            css={[transparentResizeHandleCSS, chartsResizeHandleCSS]}
          />
        </>
      )}
      <Panel id="table-content">{children}</Panel>
    </Group>
  );
}
