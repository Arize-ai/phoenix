import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  DeferredVisibilityContext,
  useDeferredVisibility,
} from "@phoenix/hooks/useDeferredVisibility";

import { CHART_MIN_WIDTH, ChartPanel } from "./ChartPanel";
import { ChartSkeleton } from "./ChartSkeleton";

/**
 * How far outside the visible area a chart begins loading, so a chart
 * arrives loaded (or already loading) as it scrolls into view: roughly one
 * chart width horizontally and one strip height vertically. Applied to both
 * the viewport (rootMargin) and any nested scroll container the chart sits
 * in (scrollMargin, where supported).
 */
const CHART_PRELOAD_MARGIN = `160px ${CHART_MIN_WIDTH + 40}px`;

const deferredChartPanelCSS = css`
  width: 100%;
  height: 100%;
  display: grid;
`;

/**
 * Defers mounting a chart panel until it is scrolled into view, showing a
 * skeleton placeholder panel in its place until then. Because charts fetch
 * their data on mount, any number of panels can be laid out in a scrolling
 * strip or page while only the visible ones load.
 *
 * Once mounted, a chart stays mounted when it scrolls back out of view — its
 * data is already cached and unmounting would discard interaction state
 * (legend toggles, brushes). Children can read the provided
 * {@link DeferredVisibilityContext} (e.g. via `useFrozenWhileHidden`) to
 * pause background refreshes while hidden.
 */
export function DeferredChartPanel({
  title,
  subtitle,
  fillHeight = false,
  children,
}: {
  /** Title shown on the placeholder panel, matching the chart's own panel */
  title: string;
  /** Subtitle shown on the placeholder panel, matching the chart's own panel */
  subtitle?: string;
  fillHeight?: boolean;
  children: ReactNode;
}) {
  const { ref, isVisible, hasBeenVisible } =
    useDeferredVisibility<HTMLDivElement>({
      rootMargin: CHART_PRELOAD_MARGIN,
      scrollMargin: CHART_PRELOAD_MARGIN,
    });
  return (
    <div ref={ref} css={deferredChartPanelCSS} className="deferred-chart-panel">
      {hasBeenVisible ? (
        <DeferredVisibilityContext.Provider value={isVisible}>
          {children}
        </DeferredVisibilityContext.Provider>
      ) : (
        <ChartPanel title={title} subtitle={subtitle} fillHeight={fillHeight}>
          <ChartSkeleton />
        </ChartPanel>
      )}
    </div>
  );
}
