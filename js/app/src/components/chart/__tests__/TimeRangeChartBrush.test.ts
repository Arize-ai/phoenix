import { ONE_DAY_MS } from "@phoenix/constants/timeConstants";

import { getBrushGestureTimeRange } from "../TimeRangeChartBrush";

const plotArea = { left: 0, top: 0, width: 100, height: 100 };
const binStartMs = Date.UTC(2026, 5, 9);

describe("getBrushGestureTimeRange", () => {
  it("selects the bin for a stationary click", () => {
    expect(
      getBrushGestureTimeRange({
        selection: {
          start: binStartMs,
          end: binStartMs,
          startX: 20,
          endX: 20,
          plotArea,
        },
        scale: "DAY",
        utcOffsetMinutes: 0,
        clickMaxDragPx: 4,
      })
    ).toEqual({
      start: new Date(binStartMs),
      end: new Date(binStartMs + ONE_DAY_MS),
    });
  });

  it("uses the mouseup bin for a small cross-boundary drag", () => {
    expect(
      getBrushGestureTimeRange({
        selection: {
          start: binStartMs,
          end: binStartMs + ONE_DAY_MS,
          startX: 20,
          endX: 22,
          plotArea,
        },
        scale: "DAY",
        utcOffsetMinutes: 0,
        clickMaxDragPx: 4,
      })
    ).toEqual({
      start: new Date(binStartMs + ONE_DAY_MS),
      end: new Date(binStartMs + 2 * ONE_DAY_MS),
    });
  });

  it("ignores a real drag whose timestamps snap to the same bin", () => {
    expect(
      getBrushGestureTimeRange({
        selection: {
          start: binStartMs,
          end: binStartMs,
          startX: 20,
          endX: 60,
          plotArea,
        },
        scale: "DAY",
        utcOffsetMinutes: 0,
        clickMaxDragPx: 4,
      })
    ).toBeNull();
  });

  it("returns the ordered range for a multi-bin drag", () => {
    expect(
      getBrushGestureTimeRange({
        selection: {
          start: binStartMs + 2 * ONE_DAY_MS,
          end: binStartMs,
          startX: 80,
          endX: 20,
          plotArea,
        },
        scale: "DAY",
        utcOffsetMinutes: 0,
        clickMaxDragPx: 4,
      })
    ).toEqual({
      start: new Date(binStartMs),
      end: new Date(binStartMs + 2 * ONE_DAY_MS),
    });
  });

  it("keeps a stationary click disabled when no scale is provided", () => {
    expect(
      getBrushGestureTimeRange({
        selection: {
          start: binStartMs,
          end: binStartMs,
          startX: 20,
          endX: 20,
          plotArea,
        },
        utcOffsetMinutes: 0,
        clickMaxDragPx: 4,
      })
    ).toBeNull();
  });
});
