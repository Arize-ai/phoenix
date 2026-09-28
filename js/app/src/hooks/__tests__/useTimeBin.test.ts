import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
} from "@phoenix/constants/timeConstants";

import { getTimeBinScale, getTimeBinSpec } from "../useTimeBin";

const end = new Date(Date.UTC(2026, 5, 9, 12));

function lastMs(durationMs: number): TimeRange {
  return { start: new Date(end.getTime() - durationMs), end };
}

describe("getTimeBinSpec", () => {
  it.each([
    {
      name: "last hour",
      timeRange: lastMs(ONE_HOUR_MS),
      maxBins: 20,
      expected: { scale: "MINUTE", interval: 5 },
    },
    {
      name: "last 5 hours",
      timeRange: lastMs(5 * ONE_HOUR_MS),
      maxBins: 20,
      expected: { scale: "MINUTE", interval: 15 },
    },
    {
      name: "last 24 hours",
      timeRange: lastMs(ONE_DAY_MS),
      maxBins: 24,
      expected: { scale: "HOUR", interval: 1 },
    },
    {
      name: "last 24 hours with fewer bins",
      timeRange: lastMs(ONE_DAY_MS),
      maxBins: 20,
      expected: { scale: "HOUR", interval: 2 },
    },
    {
      name: "last 7 days",
      timeRange: lastMs(7 * ONE_DAY_MS),
      maxBins: 20,
      expected: { scale: "DAY", interval: 1 },
    },
    {
      name: "last 30 days",
      timeRange: lastMs(30 * ONE_DAY_MS),
      maxBins: 20,
      expected: { scale: "DAY", interval: 2 },
    },
    {
      name: "a range that already fits",
      timeRange: lastMs(15 * ONE_MINUTE_MS),
      maxBins: 20,
      expected: { scale: "MINUTE", interval: 1 },
    },
  ])("picks $expected.interval × $expected.scale for $name", (testCase) => {
    expect(
      getTimeBinSpec({
        timeRange: testCase.timeRange,
        maxBins: testCase.maxBins,
      })
    ).toEqual(testCase.expected);
  });

  it("keeps the scale getTimeBinScale picks", () => {
    const timeRange = lastMs(3 * ONE_DAY_MS);
    expect(getTimeBinSpec({ timeRange, maxBins: 10 }).scale).toBe(
      getTimeBinScale({ timeRange })
    );
  });

  it("falls back to the largest multiple when none fits", () => {
    expect(
      getTimeBinSpec({ timeRange: lastMs(5 * ONE_HOUR_MS), maxBins: 2 })
    ).toEqual({ scale: "MINUTE", interval: 30 });
  });

  it("keeps calendar scales at one unit", () => {
    expect(
      getTimeBinSpec({ timeRange: lastMs(400 * ONE_DAY_MS), maxBins: 2 })
    ).toEqual({ scale: "MONTH", interval: 1 });
  });

  it("uses one unit when the range has no start", () => {
    expect(getTimeBinSpec({ timeRange: { end }, maxBins: 1 })).toEqual({
      scale: "DAY",
      interval: 1,
    });
  });
});
