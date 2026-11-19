import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
  ONE_WEEK_MS,
} from "@phoenix/constants/timeConstants";

import { getTimeBinRange } from "../timeBins";

describe("getTimeBinRange", () => {
  it.each([
    { scale: "MINUTE" as const, durationMs: ONE_MINUTE_MS },
    { scale: "HOUR" as const, durationMs: ONE_HOUR_MS },
    { scale: "DAY" as const, durationMs: ONE_DAY_MS },
    { scale: "WEEK" as const, durationMs: ONE_WEEK_MS },
  ])("returns the fixed width of a $scale bin", ({ scale, durationMs }) => {
    const binStartMs = Date.UTC(2026, 5, 9, 10);
    const range = getTimeBinRange({
      binStartMs,
      scale,
      utcOffsetMinutes: 0,
    });

    expect(range.start.getTime()).toBe(binStartMs);
    expect(range.end.getTime()).toBe(binStartMs + durationMs);
  });

  it.each([
    { scale: "DAY" as const, durationMs: ONE_DAY_MS, utcOffsetMinutes: 330 },
    { scale: "DAY" as const, durationMs: ONE_DAY_MS, utcOffsetMinutes: -300 },
    {
      scale: "WEEK" as const,
      durationMs: ONE_WEEK_MS,
      utcOffsetMinutes: 330,
    },
    {
      scale: "WEEK" as const,
      durationMs: ONE_WEEK_MS,
      utcOffsetMinutes: -300,
    },
  ])(
    "keeps $scale fixed-width at offset $utcOffsetMinutes",
    ({ scale, durationMs, utcOffsetMinutes }) => {
      const binStartMs =
        Date.UTC(2026, 5, 8) - utcOffsetMinutes * ONE_MINUTE_MS;
      const range = getTimeBinRange({
        binStartMs,
        scale,
        utcOffsetMinutes,
      });

      expect(range.end.getTime()).toBe(binStartMs + durationMs);
    }
  );

  it.each([
    {
      name: "January",
      start: [2026, 0],
      end: [2026, 1],
      utcOffsetMinutes: 0,
    },
    {
      name: "April",
      start: [2026, 3],
      end: [2026, 4],
      utcOffsetMinutes: 0,
    },
    {
      name: "leap-year February",
      start: [2024, 1],
      end: [2024, 2],
      utcOffsetMinutes: 0,
    },
    {
      name: "non-leap-year February",
      start: [2025, 1],
      end: [2025, 2],
      utcOffsetMinutes: 0,
    },
    {
      name: "January at UTC+05:30",
      start: [2026, 0],
      end: [2026, 1],
      utcOffsetMinutes: 330,
    },
    {
      name: "April at UTC-05:00",
      start: [2026, 3],
      end: [2026, 4],
      utcOffsetMinutes: -300,
    },
  ])(
    "returns the next month boundary for $name",
    ({ start, end, utcOffsetMinutes }) => {
      const utcOffsetMs = utcOffsetMinutes * ONE_MINUTE_MS;
      const binStartMs = Date.UTC(start[0]!, start[1]!) - utcOffsetMs;
      const nextBinStartMs = Date.UTC(end[0]!, end[1]!) - utcOffsetMs;
      const range = getTimeBinRange({
        binStartMs,
        scale: "MONTH",
        utcOffsetMinutes,
      });

      expect(range.start.getTime()).toBe(binStartMs);
      expect(range.end.getTime()).toBe(nextBinStartMs);
    }
  );

  it.each([
    { year: 2024, utcOffsetMinutes: 0 },
    { year: 2025, utcOffsetMinutes: 0 },
    { year: 2024, utcOffsetMinutes: 330 },
    { year: 2025, utcOffsetMinutes: -300 },
  ])(
    "returns the next year boundary for $year at offset $utcOffsetMinutes",
    ({ year, utcOffsetMinutes }) => {
      const utcOffsetMs = utcOffsetMinutes * ONE_MINUTE_MS;
      const binStartMs = Date.UTC(year, 0) - utcOffsetMs;
      const nextBinStartMs = Date.UTC(year + 1, 0) - utcOffsetMs;
      const range = getTimeBinRange({
        binStartMs,
        scale: "YEAR",
        utcOffsetMinutes,
      });

      expect(range.start.getTime()).toBe(binStartMs);
      expect(range.end.getTime()).toBe(nextBinStartMs);
    }
  );
});
