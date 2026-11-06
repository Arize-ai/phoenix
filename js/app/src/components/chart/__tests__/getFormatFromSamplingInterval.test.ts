import {
  ONE_DAY_IN_MINUTES,
  ONE_HOUR_IN_MINUTES,
} from "@phoenix/utils/timeSeriesUtils";

import { getFormatterFromSamplingInterval } from "../useTimeTickFormatter";

const date = new Date("2020-01-01T11:08:00.000Z");
const locale = "en-US";
const timeZone = "UTC";

const cases: [number, string][] = [
  [1, "11:08 AM"],
  [ONE_HOUR_IN_MINUTES * 3, "01/01/2020, 11:08 AM"],
  [ONE_DAY_IN_MINUTES, "1/1"],
  [ONE_DAY_IN_MINUTES * 3, "1/1"],
];

describe("getFormatterFromSamplingInterval", () => {
  test.each(cases)(
    "samplingIntervalMinutes: %p returns %p",
    (samplingIntervalMinutes, expectedResult) => {
      const formatter = getFormatterFromSamplingInterval({
        samplingIntervalMinutes,
        locale,
        timeZone,
      });
      const result = formatter(date);
      expect(result).toEqual(expectedResult);
    }
  );
});
