import { describe, expect, it } from "vitest";

import {
  createFullTimeFormatter,
  createShortTimeFormatter,
  createTimeRangeFormatter,
  getLocaleDateFormatPattern,
} from "../timeFormatUtils";

describe("timeFormatUtils", () => {
  const LOCALE = "en-US";
  const TIMEZONE = "UTC";

  describe("createFullTimeFormatter", () => {
    it.each([
      {
        date: new Date("2023-09-04T15:30:45Z"),
        expected: "09/04/2023, 03:30:45 PM",
      },
      {
        date: new Date("2023-09-04T00:00:00Z"),
        expected: "09/04/2023, 12:00:00 AM",
      },
      {
        date: new Date("2023-09-04T12:00:00Z"),
        expected: "09/04/2023, 12:00:00 PM",
      },
      {
        date: new Date("2024-02-29T10:15:30Z"),
        expected: "02/29/2024, 10:15:30 AM",
      },
      {
        date: new Date("2023-12-31T23:59:59Z"),
        expected: "12/31/2023, 11:59:59 PM",
      },
      {
        date: new Date("2023-01-01T00:00:00Z"),
        expected: "01/01/2023, 12:00:00 AM",
      },
    ])("should format $date as $expected", ({ date, expected }) => {
      const formatter = createFullTimeFormatter({
        locale: LOCALE,
        timeZone: TIMEZONE,
      });
      expect(formatter(date)).toBe(expected);
    });

    it("should respect different timezones", () => {
      const date = new Date("2023-09-04T15:30:45Z");
      const utcFormatter = createFullTimeFormatter({
        locale: LOCALE,
        timeZone: "UTC",
      });
      const estFormatter = createFullTimeFormatter({
        locale: LOCALE,
        timeZone: "America/New_York",
      });

      expect(utcFormatter(date)).toBe("09/04/2023, 03:30:45 PM");
      expect(estFormatter(date)).toBe("09/04/2023, 11:30:45 AM");
    });

    it.each([
      {
        locale: "en-US",
        expected: "09/04/2023, 03:30:45 PM",
      },
      {
        locale: "en-GB",
        expected: "04/09/2023, 03:30:45 pm",
      },
      {
        locale: "de-DE",
        expected: "04.09.2023, 03:30:45 PM",
      },
      {
        locale: "fr-FR",
        expected: "04/09/2023 03:30:45 PM",
      },
      {
        locale: "ja-JP",
        expected: "2023/09/04 午後03:30:45",
      },
    ])(
      "should format date according to $locale locale",
      ({ locale, expected }) => {
        const date = new Date("2023-09-04T15:30:45Z");
        const formatter = createFullTimeFormatter({
          locale,
          timeZone: TIMEZONE,
        });

        expect(formatter(date)).toBe(expected);
      }
    );
  });

  describe("createShortTimeFormatter", () => {
    it.each([
      {
        date: new Date("2023-09-04T15:30:45Z"),
        expected: "03:30 PM",
      },
      {
        date: new Date("2023-09-04T00:00:00Z"),
        expected: "12:00 AM",
      },
      {
        date: new Date("2023-09-04T12:00:00Z"),
        expected: "12:00 PM",
      },
      {
        date: new Date("2023-09-04T23:59:59Z"),
        expected: "11:59 PM",
      },
      {
        date: new Date("2023-09-04T01:15:00Z"),
        expected: "01:15 AM",
      },
    ])("should format $date as $expected", ({ date, expected }) => {
      const formatter = createShortTimeFormatter({
        locale: LOCALE,
        timeZone: TIMEZONE,
      });
      expect(formatter(date)).toBe(expected);
    });

    it("should respect different timezones", () => {
      const date = new Date("2023-09-04T15:30:00Z");
      const utcFormatter = createShortTimeFormatter({
        locale: LOCALE,
        timeZone: "UTC",
      });
      const estFormatter = createShortTimeFormatter({
        locale: LOCALE,
        timeZone: "America/New_York",
      });

      expect(utcFormatter(date)).toBe("03:30 PM");
      expect(estFormatter(date)).toBe("11:30 AM");
    });
  });

  describe("createTimeRangeFormatter", () => {
    it.each([
      {
        name: "complete range",
        start: new Date("2023-09-04T10:00:00Z"),
        end: new Date("2023-09-04T15:00:00Z"),
        expected: "09/04/2023, 10:00:00 AM - 09/04/2023, 03:00:00 PM",
      },
      {
        name: "open-ended range with only start",
        start: new Date("2023-09-04T10:00:00Z"),
        end: null,
        expected: "From 09/04/2023, 10:00:00 AM",
      },
      {
        name: "open-ended range with only end",
        start: null,
        end: new Date("2023-09-04T15:00:00Z"),
        expected: "Until 09/04/2023, 03:00:00 PM",
      },
      {
        name: "unbounded range",
        start: null,
        end: null,
        expected: "All Time",
      },
    ])("should format $name correctly", ({ start, end, expected }) => {
      const formatter = createTimeRangeFormatter({
        locale: LOCALE,
        timeZone: TIMEZONE,
      });
      expect(formatter({ start, end })).toBe(expected);
    });
  });

  describe("getLocaleDateFormatPattern", () => {
    it.each([
      {
        locale: "en-US",
        expected: "mm/dd/yyyy",
      },
      {
        locale: "en-GB",
        expected: "dd/mm/yyyy",
      },
      {
        locale: "de-DE",
        expected: "dd.mm.yyyy",
      },
      {
        locale: "fr-FR",
        expected: "dd/mm/yyyy",
      },
      {
        locale: "ja-JP",
        expected: "yyyy/mm/dd",
      },
    ])("should format $locale as $expected", ({ locale, expected }) => {
      const pattern = getLocaleDateFormatPattern(locale);
      expect(pattern).toBe(expected);
    });

    it("should return consistent pattern for the same locale", () => {
      const pattern1 = getLocaleDateFormatPattern("en-US");
      const pattern2 = getLocaleDateFormatPattern("en-US");

      expect(pattern1).toBe(pattern2);
    });
  });
});
