import { ONE_DAY_MS } from "@phoenix/constants/timeConstants";

import {
  getEvenlySpacedTimeTicks,
  getMaxTimeTickCount,
  getTimeAxisTicks,
} from "../timeTicks";

describe("getMaxTimeTickCount", () => {
  it("uses the measured width and requested minimum spacing", () => {
    expect(getMaxTimeTickCount({ width: 320, minSpacing: 96 })).toBe(4);
  });

  it("uses the fallback count before a chart is measured", () => {
    expect(
      getMaxTimeTickCount({
        width: null,
        minSpacing: 96,
        fallbackCount: 8,
      })
    ).toBe(8);
  });
});

describe("getTimeAxisTicks", () => {
  it("selects evenly spaced ticks using the measured chart width", () => {
    const startTimestamp = Date.UTC(2026, 3, 27);
    const timestamps = Array.from({ length: 31 }, (_, index) => {
      return startTimestamp + index * ONE_DAY_MS;
    });

    expect(
      getTimeAxisTicks({
        timestamps,
        width: 320,
        minSpacing: 96,
      })
    ).toEqual([timestamps[0], timestamps[8], timestamps[16], timestamps[24]]);
  });
});

describe("getEvenlySpacedTimeTicks", () => {
  it("sorts and deduplicates sparse timestamps", () => {
    expect(
      getEvenlySpacedTimeTicks({
        timestamps: [3, 1, 2, 2, Number.NaN, Number.POSITIVE_INFINITY],
        maxTickCount: 8,
      })
    ).toEqual([1, 2, 3]);
  });

  it("preserves endpoints when they fall on the uniform subset", () => {
    const startTimestamp = Date.UTC(2026, 3, 27);
    const timestamps = Array.from({ length: 31 }, (_, index) => {
      return startTimestamp + index * ONE_DAY_MS;
    });

    const ticks = getEvenlySpacedTimeTicks({
      timestamps,
      maxTickCount: 16,
    });

    expect(ticks.at(0)).toBe(timestamps.at(0));
    expect(ticks.at(-1)).toBe(timestamps.at(-1));
    expect(ticks.slice(1).map((tick, index) => tick - ticks[index]!)).toEqual(
      Array.from({ length: 15 }, () => 2 * ONE_DAY_MS)
    );
  });

  it("does not force a short trailing interval to include the final timestamp", () => {
    const startTimestamp = Date.UTC(2026, 3, 27);
    const timestamps = Array.from({ length: 31 }, (_, index) => {
      return startTimestamp + index * ONE_DAY_MS;
    });

    const ticks = getEvenlySpacedTimeTicks({
      timestamps,
      maxTickCount: 10,
    });

    expect(ticks.at(0)).toBe(timestamps.at(0));
    expect(ticks.at(-1)).toBe(timestamps.at(28));
    expect(ticks.slice(1).map((tick, index) => tick - ticks[index]!)).toEqual(
      Array.from({ length: 7 }, () => 4 * ONE_DAY_MS)
    );
  });
});
