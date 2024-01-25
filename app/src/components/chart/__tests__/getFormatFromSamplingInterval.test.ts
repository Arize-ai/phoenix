import { timeFormatLocale } from "d3-time-format";

import {
  ONE_DAY_IN_MINUTES,
  ONE_HOUR_IN_MINUTES,
} from "@phoenix/utils/timeSeriesUtils";

import { getFormatFromSamplingInterval } from "../useTimeTickFormatter";

const date = new Date("2020-01-01T11:08:00.000Z");
const cases: [number, string][] = [
  [1, "11:08 AM"],
  [ONE_HOUR_IN_MINUTES * 3, "1/1/2020 11:08 AM"],
  [ONE_DAY_IN_MINUTES, "1/1"],
  [ONE_DAY_IN_MINUTES * 3, "1/1"],
];

describe("getFormatFromSamplingInterval", () => {
  // @src: https://cdn.jsdelivr.net/npm/d3-time-format@3/locale/en-US.json
  const locale = timeFormatLocale({
    dateTime: "%x, %X",
    date: "%-m/%-d/%Y",
    time: "%-I:%M:%S %p",
    periods: ["AM", "PM"],
    days: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    shortMonths: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
  });
  test.each(cases)(
    "samplingIntervalSeconds: %p returns %p",
    (samplingInterval, expectedResult) => {
      const result = locale.utcFormat(
        getFormatFromSamplingInterval(samplingInterval)
      )(date);
      expect(result).toEqual(expectedResult);
    }
  );
});
