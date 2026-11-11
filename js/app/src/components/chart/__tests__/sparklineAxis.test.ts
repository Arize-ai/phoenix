import { describe, expect, it } from "vitest";

import {
  getSparklineBinCenter,
  getSparklineBinExtent,
  getSparklineBinRanges,
  getSparklineDrawingX,
  getSparklineWidth,
} from "../sparklineAxis";

describe("getSparklineBinRanges", () => {
  it("keeps every bin when the width gives each a few pixels", () => {
    expect(getSparklineBinRanges({ binCount: 3, width: 160 })).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
      { start: 2, end: 2 },
    ]);
  });

  it("merges equal-length runs so no bin is narrower than 4px", () => {
    // 30 bins in 112px: 28 drawn bins at most, so pairs merge into 15
    const ranges = getSparklineBinRanges({ binCount: 30, width: 112 });
    expect(ranges).toHaveLength(15);
    expect(ranges[0]).toEqual({ start: 0, end: 1 });
    expect(ranges[14]).toEqual({ start: 28, end: 29 });
  });

  it("lets the last run come up short", () => {
    expect(getSparklineBinRanges({ binCount: 5, width: 8 })).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ]);
  });
});

describe("getSparklineBinExtent and getSparklineBinCenter", () => {
  it("spaces bin centers evenly edge to edge, half a bin either side", () => {
    expect(
      getSparklineBinCenter({ range: { start: 1, end: 1 }, binCount: 3 })
    ).toBe(32);
    expect(
      getSparklineBinExtent({ range: { start: 1, end: 1 }, binCount: 3 })
    ).toEqual({ left: 16, right: 48 });
    // Clipped to the box at both ends
    expect(
      getSparklineBinExtent({ range: { start: 0, end: 0 }, binCount: 3 })
    ).toEqual({ left: 0, right: 16 });
  });

  it("gives a lone bin the whole box", () => {
    expect(
      getSparklineBinExtent({ range: { start: 0, end: 0 }, binCount: 1 })
    ).toEqual({ left: 0, right: 64 });
    expect(
      getSparklineBinCenter({ range: { start: 0, end: 0 }, binCount: 1 })
    ).toBe(32);
  });
});

describe("getSparklineWidth", () => {
  it("uses the measured width, or a fallback capped at the max width", () => {
    expect(getSparklineWidth({ measuredWidth: 90, maxWidth: 160 })).toBe(90);
    expect(getSparklineWidth({ measuredWidth: 0, maxWidth: 112 })).toBe(112);
    expect(
      getSparklineWidth({ measuredWidth: null, maxWidth: undefined })
    ).toBe(160);
  });
});

describe("getSparklineDrawingX", () => {
  it("maps the pointer into drawing units, or null before layout", () => {
    expect(
      getSparklineDrawingX({ clientX: 60, rect: { left: 10, width: 100 } })
    ).toBe(32);
    expect(
      getSparklineDrawingX({ clientX: 60, rect: { left: 10, width: 0 } })
    ).toBeNull();
  });
});
