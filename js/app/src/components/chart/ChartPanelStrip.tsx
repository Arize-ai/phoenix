import { css, keyframes } from "@emotion/react";
import type { ReactNode } from "react";

import { View } from "@phoenix/components";

import { CHART_MIN_WIDTH } from "./ChartPanel";

/** The gap between panels, in sync with `--global-dimension-size-100` */
const CHART_GAP = 8;

/** The width of the edge fades, in sync with `--global-dimension-size-300` */
const FADE_WIDTH = "var(--global-dimension-size-300)";

/** The width the strip needs to show every panel at its minimum width */
function getRequiredWidth(chartCount: number): number {
  return chartCount * CHART_MIN_WIDTH + (chartCount - 1) * CHART_GAP;
}

const fadeInKeyframes = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const fadeOutKeyframes = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

const chartPanelStripCSS = (chartCount: number) => css`
  height: 100%;
  /* Sized so the scroller below can ask whether the panels still fit */
  container-type: inline-size;

  .chart-panel-strip__scroller {
    display: flex;
    height: 100%;
    /* Let hover UI (e.g. tall chart tooltips) escape the short strip instead
       of being clipped at its bottom edge */
    overflow: visible;
  }

  .chart-panel-strip__grid {
    /* Fills the strip when the panels fit and holds its minimum width — the
       width the scroller then scrolls — when they do not */
    flex: 1 0 auto;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(${CHART_MIN_WIDTH}px, 1fr);
    gap: ${CHART_GAP}px;
    height: 100%;
  }

  /* Fades pinned to the scroller's edges, marking the panels scrolled out of
     view on that side. They take no layout width of their own (negative
     margins) and never intercept a scroll or a hover. Hidden until the strip
     both scrolls and has content past that edge — see the container query. */
  .chart-panel-strip__fade {
    position: sticky;
    flex: none;
    width: ${FADE_WIDTH};
    opacity: 0;
    pointer-events: none;
    z-index: 1;
  }

  .chart-panel-strip__fade--start {
    left: 0;
    margin-right: calc(-1 * ${FADE_WIDTH});
    background: linear-gradient(
      to right,
      var(--global-background-color-default),
      transparent
    );
  }

  .chart-panel-strip__fade--end {
    right: 0;
    margin-left: calc(-1 * ${FADE_WIDTH});
    background: linear-gradient(
      to left,
      var(--global-background-color-default),
      transparent
    );
  }

  /* Past the point where the panels no longer fit side by side, the strip
     scrolls rather than squeezing them below a readable width. Scrolling
     needs a clipping box, which costs tooltips their room to escape — a
     trade only made at widths where the charts would be unreadable anyway. */
  @container (width < ${getRequiredWidth(chartCount)}px) {
    .chart-panel-strip__scroller {
      overflow-x: auto;
      /* Clipped either way once scrolling; keeps a tall tooltip from also
         adding a vertical scrollbar */
      overflow-y: hidden;
    }

    /* Tie each fade's opacity to the scroll position, so a side shows one only
       while it has panels scrolled past it. Chrome-only CSS, guarded by
       @supports so unsupported browsers simply fall back to no fade. */
    @supports (animation-timeline: scroll()) {
      .chart-panel-strip__fade--start {
        animation: ${fadeInKeyframes} linear both;
        animation-timeline: scroll(nearest inline);
        animation-range: 0 ${FADE_WIDTH};
      }

      .chart-panel-strip__fade--end {
        animation: ${fadeOutKeyframes} linear both;
        animation-timeline: scroll(nearest inline);
        animation-range: calc(100% - ${FADE_WIDTH}) 100%;
      }
    }
  }
`;

/**
 * The horizontal strip of chart panels shown above a table (project spans,
 * traces and sessions, or dataset experiments). Panels share the available
 * width evenly down to {@link CHART_MIN_WIDTH}, after which the strip scrolls
 * horizontally so every chart stays readable, fading its edges to mark the
 * panels scrolled out of view.
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
        <div className="chart-panel-strip__scroller">
          <div
            className="chart-panel-strip__fade chart-panel-strip__fade--start"
            aria-hidden
          />
          <div className="chart-panel-strip__grid">{children}</div>
          <div
            className="chart-panel-strip__fade chart-panel-strip__fade--end"
            aria-hidden
          />
        </div>
      </div>
    </View>
  );
}
