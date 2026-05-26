import { css } from "@emotion/react";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import type { MouseHandlerDataParam } from "recharts";

const timeRangeChartScrubberCSS = css`
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

type TimeRangeChartScrubberRenderProps = {
  chartProps: {
    onMouseDown?: ChartMouseHandler;
    onMouseLeave?: ChartMouseHandler;
    onMouseMove?: ChartMouseHandler;
    onMouseUp?: ChartMouseHandler;
  };
};

type TimeRangeChartScrubberProps = {
  children: (props: TimeRangeChartScrubberRenderProps) => ReactNode;
  onTimeRangeSelected?: (timeRange: TimeRange) => void;
};

type ScrubberSelection = {
  start: number;
  end: number;
  startX: number;
  endX: number;
  plotArea: ScrubberPlotArea;
};

type ScrubberPlotArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function getTimestampFromChartValue(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  return null;
}

function getTimestampFromChartState(state: MouseHandlerDataParam) {
  return getTimestampFromChartValue(state.activeLabel);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPlotArea(container: HTMLDivElement): ScrubberPlotArea {
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

function getOrderedSelectionRange(
  selection: ScrubberSelection
): TimeRange | null {
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

export function TimeRangeChartScrubber({
  children,
  onTimeRangeSelected,
}: TimeRangeChartScrubberProps) {
  const [selection, setSelection] = useState<ScrubberSelection | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<ScrubberSelection | null>(null);
  const setScrubberSelection = (selection: ScrubberSelection | null) => {
    selectionRef.current = selection;
    setSelection(selection);
  };
  const getCursorX = (
    event: MouseEvent<SVGGraphicsElement>,
    plotArea: ScrubberPlotArea
  ) => {
    const container = containerRef.current;
    if (container == null) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    return clamp(
      event.clientX - rect.left,
      plotArea.left,
      plotArea.left + plotArea.width
    );
  };

  if (!onTimeRangeSelected) {
    return (
      <div
        ref={containerRef}
        style={{ position: "relative", width: "100%", height: "100%" }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {children({
            chartProps: {},
          })}
        </div>
      </div>
    );
  }

  const chartProps: TimeRangeChartScrubberRenderProps["chartProps"] = {
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
      setScrubberSelection({
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
      setScrubberSelection({
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
      setScrubberSelection(null);
      if (timeRange) {
        onTimeRangeSelected(timeRange);
      }
    },
    onMouseLeave: () => {
      setScrubberSelection(null);
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
      css={timeRangeChartScrubberCSS}
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
            background: "var(--chart-time-range-scrubber-fill-color)",
            borderInline:
              "1px solid var(--chart-time-range-scrubber-stroke-color)",
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
