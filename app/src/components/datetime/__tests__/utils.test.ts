import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLastNTimeRangeLabel,
  getMillisecondsUntilNextLastNTimeRangeRefresh,
  getTimeRangeFromLastNTimeRangeKey,
  getTimeRangeSearchSuggestions,
  isLastNTimeRangeKey,
  parseTimeRangeSearchText,
} from "../utils";

describe("datetime utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps last-N ranges open-ended", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));

    const timeRange = getTimeRangeFromLastNTimeRangeKey("15m");

    expect(timeRange.start?.toISOString()).toBe("2026-06-09T09:45:00.000Z");
    expect(timeRange.end).toBeNull();
  });

  it("refreshes minute-based last-N ranges at the next minute boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));

    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("15m")).toBe(30_000);
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("1h")).toBe(30_000);
  });

  it("refreshes hour-based last-N ranges at the next hour boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:15:30.000Z"));

    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("12h")).toBe(
      2_670_000
    );
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("7d")).toBe(2_670_000);
  });

  it("computes arbitrary last-N keys, snapping by window length", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:20:30.000Z"));

    // Windows up to an hour snap to the minute
    const minutes = getTimeRangeFromLastNTimeRangeKey("25m");
    expect(minutes.start?.toISOString()).toBe("2026-06-09T09:55:00.000Z");
    expect(minutes.end).toBeNull();

    // Longer windows snap to the hour
    const hours = getTimeRangeFromLastNTimeRangeKey("2h");
    expect(hours.start?.toISOString()).toBe("2026-06-09T08:00:00.000Z");
    expect(hours.end).toBeNull();

    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("25m")).toBe(30_000);
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
