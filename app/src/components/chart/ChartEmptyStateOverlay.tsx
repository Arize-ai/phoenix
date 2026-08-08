import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { Text } from "@phoenix/components";

import type { ChartTypeIconType } from "./ChartTypeIcon";
import { ChartTypeIcon } from "./ChartTypeIcon";

const DEFAULT_EMPTY_CHART_MESSAGE = "No data available";

const chartEmptyStateOverlayCSS = css`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;

  .chart-empty-state-overlay__chart {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .chart-empty-state-overlay__mask {
    position: absolute;
    inset: 0;
    background: var(--chart-empty-state-overlay-background-color);
    pointer-events: none;
    z-index: 2;
  }

  .chart-empty-state-overlay__message {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--global-dimension-size-100);
    pointer-events: none;
    text-align: center;
    z-index: 3;
  }

  .chart-empty-state-overlay__message-content {
    max-width: min(100%, 320px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--global-dimension-size-100);
    text-wrap: balance;
  }
`;

/**
 * The plot area (the cartesian grid) of the rendered chart relative to the
 * overlay container as a CSS inset shorthand value, so the empty-state
 * message can center on the plot instead of the whole chart (which includes
 * axis gutters and the legend). Returns null when there is no grid or it is
 * too small to hold a message, in which case the message centers on the
 * whole container.
 */
function measurePlotAreaInset(container: HTMLDivElement): string | null {
  const gridElement = container.querySelector<SVGGElement>(
    ".recharts-cartesian-grid"
  );
  const plotAreaRect = gridElement?.getBoundingClientRect();
  if (
    plotAreaRect == null ||
    plotAreaRect.width < 80 ||
    plotAreaRect.height < 24
  ) {
    return null;
  }
  const containerRect = container.getBoundingClientRect();
  const top = Math.round(plotAreaRect.top - containerRect.top);
  const right = Math.round(containerRect.right - plotAreaRect.right);
  const bottom = Math.round(containerRect.bottom - plotAreaRect.bottom);
  const left = Math.round(plotAreaRect.left - containerRect.left);
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

type ChartEmptyStateOverlayProps = {
  /**
   * The chart to render underneath the empty-state overlay.
   */
  children: ReactNode;
  /**
   * Whether to show the empty-state overlay.
   */
  isEmpty: boolean;
  /**
   * Short empty-state copy shown in the center of the chart's plot area.
   * @default "No data available"
   */
  message?: ReactNode;
  /**
   * When provided, a {@link ChartTypeIcon} preview glyph is shown above the
   * message so the empty plot still reads as the chart it would be — mirroring
   * the icon-above-text layout of the app's empty states.
   */
  chartType?: ChartTypeIconType;
};

/**
 * Keeps chart axes, gridlines, and layout rendered while placing a lightweight
 * empty-state overlay on top when the chart has no data to draw. The message
 * centers on the plot area rather than the chart container so it reads as
 * belonging to the (empty) plot.
 */
export function ChartEmptyStateOverlay({
  children,
  isEmpty,
  message = DEFAULT_EMPTY_CHART_MESSAGE,
  chartType,
}: ChartEmptyStateOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotAreaInset, setPlotAreaInset] = useState<string | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!isEmpty || container == null) {
      return undefined;
    }
    const measure = () => {
      const nextInset = measurePlotAreaInset(container);
      // Bail on equal insets so the mutations this state change causes don't
      // re-trigger the observers in a loop
      setPlotAreaInset((inset) => (inset === nextInset ? inset : nextInset));
    };
    // Coalesce observer bursts (e.g. tooltip-sync mutations from hovering a
    // sibling chart) into at most one layout read per frame
    let rafId: number | null = null;
    const scheduleMeasure = () => {
      rafId ??= requestAnimationFrame(() => {
        rafId = null;
        measure();
      });
    };
    measure();
    // The chart renders asynchronously (ResponsiveContainer measures first),
    // so watch for the svg to appear and for the panel to resize
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(container);
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(container, { childList: true, subtree: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isEmpty]);

  return (
    <div
      className="chart-empty-state-overlay"
      css={chartEmptyStateOverlayCSS}
      data-empty={isEmpty ? "true" : undefined}
      ref={containerRef}
    >
      <div
        aria-hidden={isEmpty ? true : undefined}
        className="chart-empty-state-overlay__chart"
      >
        {children}
      </div>
      {isEmpty ? (
        <>
          <div aria-hidden="true" className="chart-empty-state-overlay__mask" />
          <div
            className="chart-empty-state-overlay__message"
            role="status"
            style={plotAreaInset ? { inset: plotAreaInset } : undefined}
          >
            <div className="chart-empty-state-overlay__message-content">
              {chartType != null && (
                <ChartTypeIcon type={chartType} size={28} />
              )}
              {typeof message === "string" ? (
                <Text size="S" color="text-700">
                  {message}
                </Text>
              ) : (
                message
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
