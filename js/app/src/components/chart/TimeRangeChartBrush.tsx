import { css } from "@emotion/react";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import type { MouseHandlerDataParam } from "recharts";

import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { clampNumber } from "@phoenix/utils/numberUtils";

import { getTimeBinRange } from "./timeBins";

// Click slop in container pixels. Use pixels rather than snapped timestamps so
// a real drag that starts and ends in one bin remains a drag.
const CLICK_MAX_DRAG_PX = 4;

const timeRangeChartBrushCSS = css`
  /* Dragging out a selection must not select axis text or the chart svg */
  user-select: none;
  -webkit-user-select: none;

  .recharts-wrapper,
  .recharts-surface {
    cursor: crosshair !important;
  }

  &[data-bin-click="true"] {
    .recharts-wrapper,
    .recharts-surface {
      cursor: pointer !important;
    }
  }

  &[data-selecting="true"] {
    .recharts-tooltip-cursor {
      display: none;
    }

    .recharts-wrapper,
    .recharts-surface {
      cursor: crosshair !important;
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
  /**
   * Must match the `timeBinConfig.scale` used to query the chart. When
   * provided, clicking narrows the selected time range to the clicked bin.
   */
  scale?: TimeBinScale;
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
 * Convert a dragged brush selection into a normalized TimeRange with start <=
 * end. Returns null when both snapped timestamps are equal. Depending on the
 * pointer distance, callers may handle that gesture as a bin click instead.
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
 * Resolve a completed pointer gesture to either the clicked bin or the dragged
 * time range.
 *
 * @param params - completed gesture parameters
 * @param params.selection - snapped timestamps and clamped pointer positions
 * @param params.scale - chart query scale, if bin clicking is enabled
 * @param params.utcOffsetMinutes - fixed UTC offset used for chart binning
 * @param params.clickMaxDragPx - maximum pointer movement treated as a click
 */
export function getBrushGestureTimeRange({
  selection,
  scale,
  utcOffsetMinutes,
  clickMaxDragPx = CLICK_MAX_DRAG_PX,
}: {
  selection: BrushSelection;
  scale?: TimeBinScale;
  utcOffsetMinutes: number;
  clickMaxDragPx?: number;
}): TimeRange | null {
  const pointerDistance = Math.abs(selection.endX - selection.startX);
  if (scale != null && pointerDistance <= clickMaxDragPx) {
    return getTimeBinRange({
      binStartMs: selection.end,
      scale,
      utcOffsetMinutes,
    });
  }
  return getOrderedSelectionRange(selection);
}

/**
 * Wraps a recharts time-series chart with two narrowing gestures: clicking a
 * bin when `scale` is provided, or dragging a brush across a window. The chart
 * is rendered via a render prop so the brush stays agnostic to the chart's data
 * shape and axis configuration; spread the supplied `chartProps` onto the chart
 * element to wire up the mouse handlers.
 *
 * When `onTimeRangeSelected` is omitted the brush is a transparent passthrough
 * with no overlay, mouse handlers, or extra DOM, so it is safe to use even for
 * read-only charts.
 */
export function TimeRangeChartBrush({
  children,
  onTimeRangeSelected,
  scale,
}: TimeRangeChartBrushProps) {
  const utcOffsetMinutes = useUTCOffsetMinutes();
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
      setBrushSelection(null);
      const timeRange = getBrushGestureTimeRange({
        selection: nextSelection,
        scale,
        utcOffsetMinutes,
      });
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

  /* eslint-disable react/refs */
  return (
    <div
      css={timeRangeChartBrushCSS}
      data-bin-click={scale != null ? "true" : undefined}
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
          cursor: selection != null || scale == null ? "crosshair" : "pointer",
          zIndex: 1,
        }}
      >
        {children({
          chartProps,
        })}
      </div>
    </div>
  );
  /* eslint-enable react/refs */
}
