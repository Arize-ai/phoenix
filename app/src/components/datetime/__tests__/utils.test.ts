import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLastNTimeRangeLabel,
  getMillisecondsUntilNextLastNTimeRangeRefresh,
  getTimeRangeFromLastNTimeRangeKey,
  getTimeRangeSearchSuggestions,
  isLastNTimeRangeKey,
  panTimeRangeLeft,
  panTimeRangeRight,
  parseTimeRangeSearchText,
  zoomTimeRangeIn,
  zoomTimeRangeOut,
} from "../utils";

describe("datetime utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes open-ended last-N ranges, snapping and refreshing by window length", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:20:30.000Z"));

    // Windows up to an hour (inclusive) snap and refresh to the minute
    const minutes = getTimeRangeFromLastNTimeRangeKey("25m");
    expect(minutes.start?.toISOString()).toBe("2026-06-09T09:55:00.000Z");
    expect(minutes.end).toBeNull();
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("25m")).toBe(30_000);
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("1h")).toBe(30_000);

    // Longer windows snap and refresh to the hour
    const hours = getTimeRangeFromLastNTimeRangeKey("2h");
    expect(hours.start?.toISOString()).toBe("2026-06-09T08:00:00.000Z");
    expect(hours.end).toBeNull();
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("2h")).toBe(2_370_000);
  });

  it("recognizes arbitrary last-N keys and rejects malformed ones", () => {
    expect(isLastNTimeRangeKey("25m")).toBe(true);
    expect(isLastNTimeRangeKey("3d")).toBe(true);
    expect(isLastNTimeRangeKey("0m")).toBe(false);
    expect(isLastNTimeRangeKey("25")).toBe(false);
    expect(isLastNTimeRangeKey("m")).toBe(false);
    expect(isLastNTimeRangeKey("custom")).toBe(false);
  });

  it("labels presets with their curated labels and other keys spelled out", () => {
    expect(getLastNTimeRangeLabel("15m")).toBe("Last 15 Min");
    expect(getLastNTimeRangeLabel("1h")).toBe("Last Hour");
    expect(getLastNTimeRangeLabel("25m")).toBe("Last 25 minutes");
    expect(getLastNTimeRangeLabel("2h")).toBe("Last 2 hours");
    expect(getLastNTimeRangeLabel("3d")).toBe("Last 3 days");
    expect(getLastNTimeRangeLabel("90m")).toBe("Last 90 minutes");
  });

  it("parses free-form search text into last-N keys", () => {
    expect(parseTimeRangeSearchText("25m")).toBe("25m");
    expect(parseTimeRangeSearchText(" 25 min ")).toBe("25m");
    expect(parseTimeRangeSearchText("Last 25 Minutes")).toBe("25m");
    expect(parseTimeRangeSearchText("2 hr")).toBe("2h");
    expect(parseTimeRangeSearchText("last 2 hours")).toBe("2h");
    expect(parseTimeRangeSearchText("3 days")).toBe("3d");
    expect(parseTimeRangeSearchText("")).toBeNull();
    expect(parseTimeRangeSearchText("25")).toBeNull();
    expect(parseTimeRangeSearchText("0m")).toBeNull();
    expect(parseTimeRangeSearchText("25x")).toBeNull();
    expect(parseTimeRangeSearchText("last")).toBeNull();
  });

  it("suggests every unit for a bare quantity and the exact key for a duration", () => {
    expect(getTimeRangeSearchSuggestions("25")).toEqual(["25m", "25h", "25d"]);
    expect(getTimeRangeSearchSuggestions("last 3")).toEqual(["3m", "3h", "3d"]);
    expect(getTimeRangeSearchSuggestions("25m")).toEqual(["25m"]);
    expect(getTimeRangeSearchSuggestions("2 hours")).toEqual(["2h"]);
    expect(getTimeRangeSearchSuggestions("")).toEqual([]);
    expect(getTimeRangeSearchSuggestions("0")).toEqual([]);
    expect(getTimeRangeSearchSuggestions("hour")).toEqual([]);
  });
});

describe("time range pan and zoom", () => {
  const now = new Date("2026-06-09T12:00:00.000Z");

  it("pans a closed range back by half its window", () => {
    const next = panTimeRangeLeft(
      {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T10:00:00.000Z"),
        end: new Date("2026-06-09T11:00:00.000Z"),
      },
      now
    );
    expect(next).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:30:00.000Z"),
      end: new Date("2026-06-09T10:30:00.000Z"),
    });
  });

  it("pans a live range back into a closed custom range", () => {
    const next = panTimeRangeLeft(
      {
        timeRangeKey: "1h",
        start: new Date("2026-06-09T11:00:00.000Z"),
        end: null,
      },
      now
    );
    expect(next).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T10:30:00.000Z"),
      end: new Date("2026-06-09T11:30:00.000Z"),
    });
  });

  it("pans a closed range forward, clamped to now", () => {
    const halfStep = panTimeRangeRight(
      {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T09:00:00.000Z"),
        end: new Date("2026-06-09T10:00:00.000Z"),
      },
      now
    );
    expect(halfStep).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:30:00.000Z"),
      end: new Date("2026-06-09T10:30:00.000Z"),
    });

    const clamped = panTimeRangeRight(
      {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T10:45:00.000Z"),
        end: new Date("2026-06-09T11:45:00.000Z"),
      },
      now
    );
    expect(clamped).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T11:00:00.000Z"),
      end: new Date("2026-06-09T12:00:00.000Z"),
    });
  });

  it("does not pan forward past now or pan a live range forward", () => {
    expect(
      panTimeRangeRight(
        {
          timeRangeKey: "custom",
          start: new Date("2026-06-09T11:00:00.000Z"),
          end: now,
        },
        now
      )
    ).toBeNull();
    expect(
      panTimeRangeRight(
        { timeRangeKey: "1h", start: new Date("2026-06-09T11:00:00.000Z") },
        now
      )
    ).toBeNull();
  });

  it("zooms a closed range around its center", () => {
    const value = {
      timeRangeKey: "custom" as const,
      start: new Date("2026-06-09T08:00:00.000Z"),
      end: new Date("2026-06-09T10:00:00.000Z"),
    };
    expect(zoomTimeRangeIn(value, now)).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T08:30:00.000Z"),
      end: new Date("2026-06-09T09:30:00.000Z"),
    });
    expect(zoomTimeRangeOut(value, now)).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T07:00:00.000Z"),
      end: new Date("2026-06-09T11:00:00.000Z"),
    });
  });

  it("slides a zoom-out back when it would extend past now", () => {
    const next = zoomTimeRangeOut(
      {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T10:00:00.000Z"),
        end: new Date("2026-06-09T12:00:00.000Z"),
      },
      now
    );
    // Doubling around the center would end at 13:00; the overflow is pushed
    // back so the window still doubles but ends at now.
    expect(next).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T08:00:00.000Z"),
      end: new Date("2026-06-09T12:00:00.000Z"),
    });
  });

  it("keeps live ranges live, mapping zoom to the equivalent last-N key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const lastHour = {
      timeRangeKey: "1h" as const,
      start: new Date("2026-06-09T11:00:00.000Z"),
      end: null,
    };
    expect(zoomTimeRangeIn(lastHour, now)).toEqual({
      timeRangeKey: "30m",
      ...getTimeRangeFromLastNTimeRangeKey("30m"),
    });
    expect(zoomTimeRangeOut(lastHour, now)).toEqual({
      timeRangeKey: "2h",
      ...getTimeRangeFromLastNTimeRangeKey("2h"),
    });
    // Half of 7 days is 3.5 days — at two-plus days the key snaps to the
    // nearest whole day instead of dropping to "84h".
    expect(
      zoomTimeRangeIn(
        { timeRangeKey: "7d", start: new Date("2026-06-02T12:00:00.000Z") },
        now
      )?.timeRangeKey
    ).toBe("4d");
    // A fraction below two of the next unit keeps the smaller unit.
    expect(
      zoomTimeRangeIn(
        { timeRangeKey: "3h", start: new Date("2026-06-09T09:00:00.000Z") },
        now
      )?.timeRangeKey
    ).toBe("90m");
  });

  it("snaps large zoomed windows to days instead of accumulating hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Doubling out of "2048h" reads as days, not "4096h".
    expect(
      zoomTimeRangeOut(
        {
          timeRangeKey: "2048h",
          start: new Date(now.getTime() - 2048 * 60 * 60 * 1000),
          end: null,
        },
        now
      )?.timeRangeKey
    ).toBe("171d");
    // And once in days, zooming stays in days.
    expect(
      zoomTimeRangeOut(
        {
          timeRangeKey: "171d",
          start: new Date(now.getTime() - 171 * 24 * 60 * 60 * 1000),
          end: null,
        },
        now
      )?.timeRangeKey
    ).toBe("342d");
  });

  it("stops zooming in at the one minute floor", () => {
    expect(
      zoomTimeRangeIn(
        { timeRangeKey: "1m", start: new Date("2026-06-09T11:59:00.000Z") },
        now
      )
    ).toBeNull();
    expect(
      zoomTimeRangeIn(
        {
          timeRangeKey: "custom",
          start: new Date("2026-06-09T11:59:00.000Z"),
          end: now,
        },
        now
      )
    ).toBeNull();
  });

  it("returns null when the range has no resolvable window", () => {
    const startless = { timeRangeKey: "custom" as const, end: now };
    expect(panTimeRangeLeft(startless, now)).toBeNull();
    expect(panTimeRangeRight(startless, now)).toBeNull();
    expect(zoomTimeRangeIn(startless, now)).toBeNull();
    expect(zoomTimeRangeOut(startless, now)).toBeNull();
  });
});
