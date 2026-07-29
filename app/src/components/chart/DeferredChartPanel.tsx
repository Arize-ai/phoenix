import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

import { useDeferredVisibility } from "@phoenix/hooks/useDeferredVisibility";

import { ChartPanel } from "./ChartPanel";
import { ChartSkeleton } from "./ChartSkeleton";

/**
 * How far outside the visible area a chart begins loading, so a chart
 * arrives loaded (or already loading) as it scrolls into view: roughly one
 * chart width horizontally and one strip height vertically. Applied to both
 * the viewport (rootMargin) and any nested scroll container the chart sits
 * in (scrollMargin, where supported).
 */
const CHART_PRELOAD_MARGIN = "160px 440px";

const ChartVisibilityContext = createContext<boolean>(true);

/**
 * Whether the nearest {@link DeferredChartPanel} ancestor is currently
 * scrolled into view; `true` when there is none. Lets data layers pause
 * background refreshes for charts that are mounted but out of view.
 */
export function useChartVisibility(): boolean {
  return useContext(ChartVisibilityContext);
}

/**
 * The latest `value` seen while the nearest {@link DeferredChartPanel} was in
 * view; while it is out of view the last-seen value is returned unchanged. Use
 * it to freeze a chart's query inputs (fetch keys, live time ranges) so
 * background refreshes don't refetch charts the user can't see — a chart
 * scrolled back into view picks up the current value and catches up.
 * Passes `value` through when there is no DeferredChartPanel ancestor.
 */
export function useVisibleValue<T>(value: T): T {
  const isVisible = useChartVisibility();
  const [visibleValue, setVisibleValue] = useState(value);
  if (isVisible && visibleValue !== value) {
    setVisibleValue(value);
  }
  return visibleValue;
}

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
 * (legend toggles, brushes). Children can read {@link useChartVisibility} to
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
        <ChartVisibilityContext.Provider value={isVisible}>
          {children}
        </ChartVisibilityContext.Provider>
      ) : (
        <ChartPanel title={title} subtitle={subtitle} fillHeight={fillHeight}>
          <ChartSkeleton />
        </ChartPanel>
      )}
    </div>
  );
}
