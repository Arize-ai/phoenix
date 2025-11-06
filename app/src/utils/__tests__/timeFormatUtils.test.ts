import { describe, expect, it, vi } from "vitest";

import {
  fullTimeFormatter,
  shortDateTimeFormatter,
  shortTimeFormatter,
} from "../timeFormatUtils";

describe("timeFormatUtils", () => {
  const testDate = new Date("2023-09-04T15:30:45");

  describe("fullTimeFormatter", () => {
    it("should format date and time", () => {
      const result = fullTimeFormatter(testDate);
      // Should include date, time with seconds, and AM/PM
      expect(result).toMatch(/2023/);
      expect(result).toMatch(/15:30:45/);
      expect(result).toMatch(/PM/);
    });

    it("should use browser locale for date formatting", () => {
      const result = fullTimeFormatter(testDate);
      // The exact format depends on the browser's locale
      // But it should contain the year, and time components
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe("shortTimeFormatter", () => {
    it("should format time only without seconds", () => {
      const result = shortTimeFormatter(testDate);
      expect(result).toBe("15:30 PM");
    });

    it("should handle midnight correctly", () => {
      const midnight = new Date("2023-09-04T00:00:00");
      const result = shortTimeFormatter(midnight);
      expect(result).toBe("00:00 AM");
    });

    it("should handle noon correctly", () => {
      const noon = new Date("2023-09-04T12:00:00");
      const result = shortTimeFormatter(noon);
      expect(result).toBe("12:00 PM");
    });
  });

  describe("shortDateTimeFormatter", () => {
    it("should format date and time without seconds", () => {
      const result = shortDateTimeFormatter(testDate);
      // Should include date, time without seconds, and AM/PM
      expect(result).toMatch(/2023/);
      expect(result).toMatch(/15:30/);
      expect(result).toMatch(/PM/);
      expect(result).not.toMatch(/15:30:45/);
    });
  });

  describe("locale awareness", () => {
    it("should respect browser locale", () => {
      // Mock the Intl.DateTimeFormat to return a specific locale
      const originalDateTimeFormat = Intl.DateTimeFormat;

      // Test with en-US locale
      vi.spyOn(Intl, "DateTimeFormat").mockImplementation((locale, options) => {
        return new originalDateTimeFormat(locale || "en-US", options);
      });

      const result = fullTimeFormatter(testDate);
      expect(result).toBeTruthy();

      vi.restoreAllMocks();
    });
  });

  describe("edge cases", () => {
    it("should handle leap year dates", () => {
      const leapDate = new Date("2024-02-29T10:15:30");
      const result = fullTimeFormatter(leapDate);
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/10:15:30/);
    });

    it("should handle end of year", () => {
      const endOfYear = new Date("2023-12-31T23:59:59");
      const result = fullTimeFormatter(endOfYear);
      expect(result).toMatch(/2023/);
      expect(result).toMatch(/23:59:59/);
    });
  });
});
