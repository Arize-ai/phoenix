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

  it('advances the date when Intl renders midnight as hour "24"', () => {
    // Some engines render midnight as "24:00:00" on the previous day.
    // Mock formatToParts to simulate this: midnight May 6 UTC shown as
    // 24:00:00 on May 5.
    const OriginalDTF = Intl.DateTimeFormat;

    // Replace the global with a subclass that simulates the "24" convention:
    // midnight May 6 is rendered as May 5, 24:00:00.
    const MockDateTimeFormat = class extends OriginalDTF {
      formatToParts(date?: number | Date): Intl.DateTimeFormatPart[] {
        return super.formatToParts(date).map((p) => {
          if (p.type === "hour") return { ...p, value: "24" };
          // Roll day back to simulate the "24" convention (previous day).
          if (p.type === "day") {
            return {
              ...p,
              value: String(Number(p.value) - 1).padStart(2, "0"),
            };
          }
          return p;
        });
      }
    };
    Object.assign(Intl, { DateTimeFormat: MockDateTimeFormat });

    try {
      // Midnight May 6 UTC — with the mock, formatToParts returns day "05"
      // and hour "24", so the function must advance to May 6 and use "00".
      const date = new Date("2026-05-06T00:00:00Z");
      const result = toLocalISOWithOffset(date, "UTC");
      expect(result).toBe("2026-05-06T00:00:00+00:00");
    } finally {
      Object.assign(Intl, { DateTimeFormat: OriginalDTF });
    }
  });
});
