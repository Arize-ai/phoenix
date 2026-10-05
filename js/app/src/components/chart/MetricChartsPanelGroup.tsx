import { css } from "@emotion/react";
import type { ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { transparentResizeHandleCSS } from "@phoenix/components/resize";

const CHARTS_PANEL_DEFAULT_SIZE_PIXELS = 230;
const CHARTS_PANEL_MIN_SIZE_PIXELS = 160;
const CHARTS_PANEL_MAX_SIZE = "60%";

const PANEL_IDS_WITH_CHARTS = ["metrics-charts", "table-content"];
const PANEL_IDS_WITHOUT_CHARTS = ["table-content"];

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
 * Lays out a metric charts strip above a table in a vertically resizable
 * panel group. A transparent drag handle sits between the charts and the
 * content so the charts can take up more or less vertical space. Without
 * charts, the charts panel and handle are not rendered and the content fills
 * the space. The layout persists under `layoutId` so the strip keeps its
 * height across reloads and remounts.
 */
export function MetricChartsPanelGroup({
  layoutId,
  charts,
  children,
}: {
  layoutId: string;
  /**
   * The charts strip, or null when no charts are selected
   */
  charts: ReactNode | null;
  children: ReactNode;
}) {
  const hasCharts = charts != null;
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
            {charts}
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
