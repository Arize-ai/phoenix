import { describe, expect, it } from "vitest";

import { toLocalISOWithOffset } from "../timeUtils";

describe("toLocalISOWithOffset", () => {
  it("formats a UTC date with +00:00 offset", () => {
    const date = new Date("2026-05-05T12:30:00Z");
    expect(toLocalISOWithOffset(date, "UTC")).toBe("2026-05-05T12:30:00+00:00");
  });

  it("formats with a negative offset (US Pacific, standard time)", () => {
    // 2026-01-15 in PST (UTC-8)
    const date = new Date("2026-01-15T20:00:00Z");
    const result = toLocalISOWithOffset(date, "America/Los_Angeles");
    expect(result).toBe("2026-01-15T12:00:00-08:00");
  });

  it("formats with a positive offset (Asia/Tokyo, UTC+9)", () => {
    const date = new Date("2026-05-05T00:00:00Z");
    const result = toLocalISOWithOffset(date, "Asia/Tokyo");
    expect(result).toBe("2026-05-05T09:00:00+09:00");
  });

  it("formats with a half-hour offset (Asia/Kolkata, UTC+5:30)", () => {
    const date = new Date("2026-05-05T00:00:00Z");
    const result = toLocalISOWithOffset(date, "Asia/Kolkata");
    expect(result).toBe("2026-05-05T05:30:00+05:30");
  });

  it("shifts the date across a day boundary", () => {
    // Late UTC wraps to next day in Tokyo
    const date = new Date("2026-05-05T23:00:00Z");
    const result = toLocalISOWithOffset(date, "Asia/Tokyo");
    expect(result).toBe("2026-05-06T08:00:00+09:00");
  });

  it("matches ISO 8601 format pattern", () => {
    const date = new Date("2026-07-15T10:45:30Z");
    const result = toLocalISOWithOffset(date, "Europe/Berlin");
    expect(result).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    );
  });
});
