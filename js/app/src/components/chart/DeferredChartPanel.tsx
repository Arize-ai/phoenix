import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { useDeferredVisibility } from "@phoenix/hooks/useDeferredVisibility";
import { DeferredVisibilityContext } from "@phoenix/hooks/useFrozenWhileHidden";

import { CHART_MIN_WIDTH, ChartPanel } from "./ChartPanel";
import { ChartSkeleton } from "./ChartSkeleton";

/**
 * How far outside the visible area a chart begins loading — about one strip
 * height (160px) vertically and one chart width plus gap horizontally — so
 * it arrives loaded (or loading) as it scrolls into view.
 */
const CHART_PRELOAD_MARGIN = `160px ${CHART_MIN_WIDTH + 40}px`;

const deferredChartPanelCSS = css`
  width: 100%;
  height: 100%;
  display: grid;
`;

/**
 * Defers mounting a chart panel — and so its data fetch — until it scrolls
 * into view, showing a skeleton panel until then. Once mounted, the chart
 * stays mounted offscreen: its data is already cached and unmounting would
 * lose interaction state. Children can read the provided
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
  /** Subtitle for the placeholder panel */
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
