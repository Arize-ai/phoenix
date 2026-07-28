import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { View } from "@phoenix/components";

import { CHART_MIN_WIDTH } from "./ChartPanel";

/** The gap between panels, in sync with `--global-dimension-size-100` */
const CHART_GAP = 8;

/** The width the strip needs to show every panel at its minimum width */
function getRequiredWidth(chartCount: number): number {
  return chartCount * CHART_MIN_WIDTH + (chartCount - 1) * CHART_GAP;
}

const chartPanelStripCSS = (chartCount: number) => css`
  height: 100%;
  /* Sized so the grid below can ask whether the panels still fit */
  container-type: inline-size;

  .chart-panel-strip__grid {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(${CHART_MIN_WIDTH}px, 1fr);
    gap: ${CHART_GAP}px;
    height: 100%;
    /* Let hover UI (e.g. tall chart tooltips) escape the short strip instead
       of being clipped at its bottom edge */
    overflow: visible;
  }

  /* Past the point where the panels no longer fit side by side, the strip
     scrolls rather than squeezing them below a readable width. Scrolling
     needs a clipping box, which costs tooltips their room to escape — a
     trade only made at widths where the charts would be unreadable anyway. */
  @container (width < ${getRequiredWidth(chartCount)}px) {
    .chart-panel-strip__grid {
      overflow-x: auto;
      /* Clipped either way once scrolling; keeps a tall tooltip from also
         adding a vertical scrollbar */
      overflow-y: hidden;
    }
  }
`;

/**
 * The horizontal strip of chart panels shown above a table (project spans,
 * traces and sessions, or dataset experiments). Panels share the available
 * width evenly down to {@link CHART_MIN_WIDTH}, after which the strip scrolls
 * horizontally so every chart stays readable.
 */
export function ChartPanelStrip({
  chartCount,
  children,
}: {
  /** How many chart panels `children` renders */
  chartCount: number;
  children: ReactNode;
}) {
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
      <div css={chartPanelStripCSS(chartCount)}>
        <div className="chart-panel-strip__grid">{children}</div>
      </div>
    </View>
  );
}
