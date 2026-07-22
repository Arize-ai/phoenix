import { css } from "@emotion/react";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import type { MouseHandlerDataParam } from "recharts";

import { clampNumber } from "@phoenix/utils/numberUtils";

const timeRangeChartBrushCSS = css`
  /* Dragging out a selection must not select axis text or the chart svg */
  user-select: none;
  -webkit-user-select: none;

  .recharts-wrapper,
  .recharts-surface {
    cursor: crosshair !important;
  }

  &[data-selecting="true"] {
    .recharts-tooltip-cursor {
      display: none;
    }
  }
`;

type ChartMouseHandler = (
  nextState: MouseHandlerDataParam,
  event: MouseEvent<SVGGraphicsElement>
) => void;

type TimeRangeChartBrushRenderProps = {
  chartProps: {
    accessibilityLayer: false;
    onMouseDown?: ChartMouseHandler;
    onMouseLeave?: ChartMouseHandler;
    onMouseMove?: ChartMouseHandler;
    onMouseUp?: ChartMouseHandler;
  };
};

type TimeRangeChartBrushProps = {
  children: (props: TimeRangeChartBrushRenderProps) => ReactNode;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
};

type BrushSelection = {
  start: number;
  end: number;
  startX: number;
  endX: number;
  plotArea: BrushPlotArea;
};

type BrushPlotArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const nonFocusableChartProps = {
  accessibilityLayer: false,
} satisfies TimeRangeChartBrushRenderProps["chartProps"];

/**
 * Coerce a recharts `activeLabel` (number, Date, ISO string, or numeric string)
 * to an epoch milliseconds timestamp. Returns null for any value that can't be
 * interpreted as a finite instant.
 */
function getTimestampFromChartValue(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }
    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
    const timestamp = new Date(trimmed).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  return null;
}

function getTimestampFromChartState(state: MouseHandlerDataParam) {
  return getTimestampFromChartValue(state.activeLabel);
}

/**
 * Compute the chart's plot area (the cartesian grid) relative to the brush
 * container. Falls back to the full container rect when the grid hasn't been
 * laid out yet so the overlay still has a valid bounding box on first paint.
 */
function getPlotArea(container: HTMLDivElement): BrushPlotArea {
  const containerRect = container.getBoundingClientRect();
  const gridElement = container.querySelector<SVGGElement>(
    ".recharts-cartesian-grid"
  );
  const plotAreaRect = gridElement?.getBoundingClientRect();
  if (
    plotAreaRect != null &&
    plotAreaRect.width > 0 &&
    plotAreaRect.height > 0
  ) {
    return {
      left: plotAreaRect.left - containerRect.left,
      top: plotAreaRect.top - containerRect.top,
      width: plotAreaRect.width,
      height: plotAreaRect.height,
    };
  }

  return {
    left: 0,
    top: 0,
    width: containerRect.width,
    height: containerRect.height,
  };
}

/**
 * Convert an in-progress brush selection into a normalized TimeRange with
 * start <= end. Returns null for zero-width selections (e.g. a click without
 * a drag) so callers can ignore non-gestures.
 */
function getOrderedSelectionRange(selection: BrushSelection): TimeRange | null {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  if (start === end) {
    return null;
  }
  return {
    start: new Date(start),
    end: new Date(end),
  };
}

/**
 * Wraps a recharts time-series chart with a click-and-drag brush that emits a
 * `TimeRange` for the selected window. The chart is rendered via a render prop
 * so the brush stays agnostic to the chart's data shape and axis configuration;
 * spread the supplied `chartProps` onto the chart element to wire up the mouse
 * handlers.
 *
 * When `onTimeRangeSelected` is omitted the brush is a transparent passthrough
 * with no overlay, mouse handlers, or extra DOM, so it is safe to use even for
 * read-only charts.
 */
export function TimeRangeChartBrush({
  children,
  onTimeRangeSelected,
}: TimeRangeChartBrushProps) {
  const [selection, setSelection] = useState<BrushSelection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<BrushSelection | null>(null);
  const setBrushSelection = (selection: BrushSelection | null) => {
    selectionRef.current = selection;
    setSelection(selection);
  };
  const getCursorX = (
    event: MouseEvent<SVGGraphicsElement>,
    plotArea: BrushPlotArea
  ) => {
    const container = containerRef.current;
    if (container == null) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    return clampNumber({
      value: event.clientX - rect.left,
      min: plotArea.left,
      max: plotArea.left + plotArea.width,
    });
  };

  if (!onTimeRangeSelected) {
    return <>{children({ chartProps: nonFocusableChartProps })}</>;
  }

  const chartProps: TimeRangeChartBrushRenderProps["chartProps"] = {
    ...nonFocusableChartProps,
    onMouseDown: (state, event) => {
      if (event.button !== 0) {
        return;
      }
      const timestamp = getTimestampFromChartState(state);
      if (timestamp == null) {
        return;
      }
      const container = containerRef.current;
      if (container == null) {
        return;
      }
      const plotArea = getPlotArea(container);
      const cursorX = getCursorX(event, plotArea);
      if (cursorX == null) {
        return;
      }
      setBrushSelection({
        start: timestamp,
        end: timestamp,
        startX: cursorX,
        endX: cursorX,
        plotArea,
      });
    },
    onMouseMove: (state, event) => {
      const currentSelection = selectionRef.current;
      if (currentSelection == null) {
        return;
      }
      const timestamp = getTimestampFromChartState(state);
      if (timestamp == null) {
        return;
      }
      const cursorX = getCursorX(event, currentSelection.plotArea);
      if (cursorX == null) {
        return;
      }
      setBrushSelection({
        start: currentSelection.start,
        end: timestamp,
        startX: currentSelection.startX,
        endX: cursorX,
        plotArea: currentSelection.plotArea,
      });
    },
    onMouseUp: (state, event) => {
      const currentSelection = selectionRef.current;
      if (currentSelection == null) {
        return;
      }
      const timestamp = getTimestampFromChartState(state);
      const cursorX = getCursorX(event, currentSelection.plotArea);
      const nextSelection =
        timestamp == null
          ? currentSelection
          : {
              ...currentSelection,
              end: timestamp,
              endX: cursorX ?? currentSelection.endX,
            };
      const timeRange = getOrderedSelectionRange(nextSelection);
      setBrushSelection(null);
      if (timeRange) {
        onTimeRangeSelected(timeRange);
      }
    },
    onMouseLeave: () => {
      setBrushSelection(null);
    },
  };

  const overlayLeft =
    selection == null ? 0 : Math.min(selection.startX, selection.endX);
  const overlayWidth =
    selection == null ? 0 : Math.abs(selection.startX - selection.endX);
  const overlayTop = selection?.plotArea.top ?? 0;
  const overlayHeight = selection?.plotArea.height ?? 0;

  return (
    <div
      css={timeRangeChartBrushCSS}
      data-selecting={selection != null ? "true" : undefined}
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {selection != null && overlayWidth > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: overlayTop,
            height: overlayHeight,
            left: overlayLeft,
            width: overlayWidth,
            background: "var(--chart-time-range-brush-fill-color)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          cursor: "crosshair",
          zIndex: 1,
        }}
      >
        {children({
          chartProps,
        })}
      </div>
    </div>
  );
}
