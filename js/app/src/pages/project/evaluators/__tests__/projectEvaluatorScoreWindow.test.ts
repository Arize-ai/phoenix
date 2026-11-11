import { describe, expect, it } from "vitest";

import { getTimeRangeFromLastNTimeRangeKey } from "@phoenix/components/datetime/utils";

import {
  getEvaluatorScoreWindow,
  isSameEvaluatorScoreWindow,
} from "../projectEvaluatorScoreWindow";

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

  it("sends a live range over the cap as the live 30-day range", () => {
    const window = getEvaluatorScoreWindow({
      timeRange: {
        timeRangeKey: "90d",
        start: new Date("2026-03-11T12:00:00.000Z"),
        end: null,
      },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    // The same start the time range provider gives a live "30d" range now,
    // so the two share query variables and the newest scores stay in.
    const start = getTimeRangeFromLastNTimeRangeKey("30d", now.getTime()).start;
    expect(window).toEqual(
      getEvaluatorScoreWindow({
        timeRange: { timeRangeKey: "30d", start, end: null },
        utcOffsetMinutes: UTC_OFFSET_MINUTES,
        now,
      })
    );
    expect(window.timeRange).toEqual({ start: start?.toISOString() });
    expect(window.windowKey).toBe("30d");
  });

  it("clamps a custom range over the cap to its trailing 30 days, previous window included", () => {
    const window = getEvaluatorScoreWindow({
      timeRange: {
        timeRangeKey: "custom",
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-06-01T00:00:00.000Z"),
      },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    expect(window.timeRange).toEqual({
      start: "2026-05-02T00:00:00.000Z",
      end: "2026-06-01T00:00:00.000Z",
    });
    // The previous window mirrors the clamped 30 days, not the page range
    expect(window.previousTimeRange).toEqual({
      start: "2026-04-02T00:00:00.000Z",
      end: "2026-05-02T00:00:00.000Z",
    });
    expect(window.windowKey).toBe("30d");
  });

  it("closes a custom range with no end at now", () => {
    const start = new Date("2026-06-09T11:50:00.000Z");
    const window = getEvaluatorScoreWindow({
      timeRange: { timeRangeKey: "custom", start, end: null },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now,
    });
    expect(window.timeRange).toEqual({
      start: start.toISOString(),
      end: now.toISOString(),
    });
    expect(window.previousTimeRange).toEqual({
      start: new Date(
        start.getTime() - (now.getTime() - start.getTime())
      ).toISOString(),
      end: start.toISOString(),
    });
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

  it("bins a live range at a scale boundary as the page's charts do, whatever now is", () => {
    // The live window runs a little past the key's duration for nearly the
    // whole snap interval, so a "5h" range bins by the hour and a "5d" range
    // by the day, even at the instant now is exactly one key's duration past
    // the start, so the scale never changes between renders.
    const fiveHoursStart = new Date("2026-06-09T07:00:00.000Z");
    const fiveHours = getEvaluatorScoreWindow({
      timeRange: { timeRangeKey: "5h", start: fiveHoursStart, end: null },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now: new Date(fiveHoursStart.getTime() + 5 * 60 * 60 * 1000),
    });
    expect(fiveHours.timeBinConfig.scale).toBe("HOUR");
    const fiveDaysStart = new Date("2026-06-04T12:00:00.000Z");
    const fiveDays = getEvaluatorScoreWindow({
      timeRange: { timeRangeKey: "5d", start: fiveDaysStart, end: null },
      utcOffsetMinutes: UTC_OFFSET_MINUTES,
      now: new Date(fiveDaysStart.getTime() + 5 * 24 * 60 * 60 * 1000),
    });
    expect(fiveDays.timeBinConfig.scale).toBe("DAY");
  });
});

describe("isSameEvaluatorScoreWindow", () => {
  const window = getEvaluatorScoreWindow({
    timeRange: {
      timeRangeKey: "custom",
      start: new Date("2026-06-01T00:00:00.000Z"),
      end: new Date("2026-06-03T00:00:00.000Z"),
    },
    utcOffsetMinutes: UTC_OFFSET_MINUTES,
    now,
  });

  it("matches an identical window", () => {
    expect(isSameEvaluatorScoreWindow(window, structuredClone(window))).toBe(
      true
    );
  });

  it.each([
    { timeRange: { ...window.timeRange, start: "2026-06-01T01:00:00.000Z" } },
    { timeRange: { start: window.timeRange.start } },
    {
      previousTimeRange: {
        ...window.previousTimeRange,
        start: "2026-05-30T01:00:00.000Z",
      },
    },
    {
      previousTimeRange: {
        ...window.previousTimeRange,
        end: "2026-06-01T01:00:00.000Z",
      },
    },
    { timeBinConfig: { ...window.timeBinConfig, scale: "DAY" as const } },
    { timeBinConfig: { ...window.timeBinConfig, utcOffsetMinutes: 60 } },
    { windowKey: "3d" },
  ])("differs when one field changes: %o", (change) => {
    expect(isSameEvaluatorScoreWindow(window, { ...window, ...change })).toBe(
      false
    );
  });
});
