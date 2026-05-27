import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components";

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
    padding: var(--global-dimension-static-size-200);
    pointer-events: none;
    text-align: center;
    z-index: 3;
  }

  .chart-empty-state-overlay__message-content {
    max-width: min(100%, 320px);
    color: var(--chart-empty-state-text-color);
  }
`;

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
   * Short empty-state copy shown in the center of the chart.
   * @default "No data available"
   */
  message?: ReactNode;
};

/**
 * Keeps chart axes, gridlines, and layout rendered while placing a lightweight
 * empty-state overlay on top when the chart has no data to draw.
 */
export function ChartEmptyStateOverlay({
  children,
  isEmpty,
  message = DEFAULT_EMPTY_CHART_MESSAGE,
}: ChartEmptyStateOverlayProps) {
  return (
    <div
      className="chart-empty-state-overlay"
      css={chartEmptyStateOverlayCSS}
      data-empty={isEmpty ? "true" : undefined}
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
          <div className="chart-empty-state-overlay__message" role="status">
            <div className="chart-empty-state-overlay__message-content">
              {typeof message === "string" ? (
                <Text color="inherit" size="M" weight="heavy">
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
