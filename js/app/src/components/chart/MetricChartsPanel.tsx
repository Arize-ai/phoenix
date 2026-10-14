import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Panel, Separator, useDefaultLayout } from "react-resizable-panels";

import { transparentResizeHandleCSS } from "@phoenix/components/resize";

import { CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS } from "./ChartPanelStrip";

const CHARTS_PANEL_MIN_SIZE_PIXELS = 160;
const CHARTS_PANEL_MAX_SIZE = "60%";

/**
 * The id of the {@link MetricChartsPanel}
 */
export const METRIC_CHARTS_PANEL_ID = "metrics-charts";

/**
 * The id of the panel holding the content below a {@link MetricChartsPanel},
 * e.g. a table and its toolbar
 */
export const METRIC_CHARTS_CONTENT_PANEL_ID = "table-content";

/**
 * Pull the following panel up by the handle's height so the handle adds no
 * layout height of its own — it overlays the top of the content's padding
 * instead. Keeps the vertical rhythm around the content's toolbar consistent
 * while preserving the handle's hover/drag hit area.
 */
const chartsResizeHandleCSS = css`
  margin-bottom: calc(-1 * var(--resize-handle-size));
  position: relative;
  z-index: 1;
`;

/**
 * The persisted layout of a vertical panel group that holds a
 * {@link MetricChartsPanel} above a content panel, so the charts keep their
 * height across reloads and remounts. Spread the result onto the `Group`.
 */
export function useMetricChartsLayout({
  id,
  isChartsPanelShown,
}: {
  /**
   * Uniquely identifies the layout in storage
   */
  id: string;
  /**
   * Whether the group renders the {@link MetricChartsPanel}
   */
  isChartsPanelShown: boolean;
}) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id,
    panelIds: isChartsPanelShown
      ? [METRIC_CHARTS_PANEL_ID, METRIC_CHARTS_CONTENT_PANEL_ID]
      : [METRIC_CHARTS_CONTENT_PANEL_ID],
    storage: localStorage,
  });
  return { id, defaultLayout, onLayoutChanged };
}

/**
 * A vertically resizable panel for a metric charts strip, followed by a
 * transparent drag handle so the charts can take up more or less space. Place
 * it in a vertical `Group` above a panel with
 * {@link METRIC_CHARTS_CONTENT_PANEL_ID}.
 */
export function MetricChartsPanel({ children }: { children: ReactNode }) {
  return (
    <>
      <Panel
        id={METRIC_CHARTS_PANEL_ID}
        defaultSize={CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}
        minSize={CHARTS_PANEL_MIN_SIZE_PIXELS}
        maxSize={CHARTS_PANEL_MAX_SIZE}
        groupResizeBehavior="preserve-pixel-size"
        style={{ overflow: "visible" }}
      >
        {children}
      </Panel>
      <Separator css={[transparentResizeHandleCSS, chartsResizeHandleCSS]} />
    </>
  );
}
