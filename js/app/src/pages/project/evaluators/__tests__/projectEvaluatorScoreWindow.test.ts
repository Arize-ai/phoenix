import { describe, expect, it } from "vitest";

import { getEvaluatorScoreWindow } from "../projectEvaluatorScoreWindow";

const UTC_OFFSET_MINUTES = 0;
const now = new Date("2026-06-09T12:34:56.789Z");

describe("getEvaluatorScoreWindow", () => {
  it("keeps a live last-N window open-ended and independent of now", () => {
    // The provider hands a snapped start with no end for live ranges
    const start = new Date("2026-06-02T12:00:00.000Z");
    const timeRange = { timeRangeKey: "7d" as const, start, end: null };
    const window = getEvaluatorScoreWindow({
      timeRange,
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    expect(window.timeRange).toEqual({ start: start.toISOString() });
    // The previous window mirrors the key's exact duration backward
    expect(window.previousTimeRange).toEqual({
      start: "2026-05-26T12:00:00.000Z",
      end: start.toISOString(),
    });
    expect(window.windowKey).toBe("7d");
    // Nothing depends on "now": a different clock yields identical variables
    const later = getEvaluatorScoreWindow({
      timeRange,
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now: new Date("2026-06-09T12:59:59.999Z"),
    });
    expect(later).toEqual(window);
  });

  it("keeps a custom range closed with a mirrored previous window", () => {
    const window = getEvaluatorScoreWindow({
      timeRange: {
        timeRangeKey: "custom",
        start: new Date("2026-06-01T00:00:00.000Z"),
        end: new Date("2026-06-03T00:00:00.000Z"),
      },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    expect(window.timeRange).toEqual({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-03T00:00:00.000Z",
    });
    expect(window.previousTimeRange).toEqual({
      start: "2026-05-30T00:00:00.000Z",
      end: "2026-06-01T00:00:00.000Z",
    });
    expect(window.windowKey).toBe("2d");
  });

  it("clamps a live range over the cap to its trailing 30 days, hour-snapped", () => {
    const window = getEvaluatorScoreWindow({
      timeRange: {
        timeRangeKey: "90d",
        start: new Date("2026-03-11T12:00:00.000Z"),
        end: null,
      },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    // Resolved "now" snaps to the hour so repeated derivations stay stable
    expect(window.timeRange).toEqual({
      start: "2026-05-10T12:00:00.000Z",
      end: "2026-06-09T12:00:00.000Z",
    });
    expect(window.previousTimeRange).toEqual({
      start: "2026-04-10T12:00:00.000Z",
      end: "2026-05-10T12:00:00.000Z",
    });
    expect(window.windowKey).toBe("30d");
  });

  it("chooses the bin scale from the window duration", () => {
    const day = getEvaluatorScoreWindow({
      timeRange: {
        timeRangeKey: "7d",
        start: new Date("2026-06-02T12:00:00.000Z"),
        end: null,
      },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    expect(day.timeBinConfig).toEqual({ scale: "DAY", utcOffsetMinutes: 0 });
    const minute = getEvaluatorScoreWindow({
      timeRange: {
        timeRangeKey: "1h",
        start: new Date("2026-06-09T11:34:00.000Z"),
        end: null,
      },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    expect(minute.timeRange).toEqual({ start: "2026-06-09T11:34:00.000Z" });
    expect(minute.timeBinConfig.scale).toBe("MINUTE");
    expect(minute.windowKey).toBe("1h");
  });
});
