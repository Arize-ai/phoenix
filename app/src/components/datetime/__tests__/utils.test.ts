import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMillisecondsUntilNextLastNTimeRangeRefresh,
  getTimeRangeFromLastNTimeRangeKey,
} from "../utils";

describe("datetime utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps last-N ranges open-ended", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));

    const timeRange = getTimeRangeFromLastNTimeRangeKey("15m");

    expect(timeRange.start?.toISOString()).toBe(
      "2026-06-09T09:45:00.000Z"
    );
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
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("7d")).toBe(
      2_670_000
    );
  });
});
