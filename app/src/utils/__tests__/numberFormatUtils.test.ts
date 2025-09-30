import {
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
  ONE_SECOND_MS,
} from "@phoenix/constants/timeConstants";

import { formatFloat, formatInt, formatLatencyMs } from "../numberFormatUtils";

describe("formatInt", () => {
  it("formats integers cleanly", () => {
    expect(formatInt(1234234)).toEqual("1.2M");
    expect(formatInt(1230)).toEqual("1,230");
    expect(formatInt(12379)).toEqual("12,379");
    expect(formatInt(-12379)).toEqual("−12,379");
    expect(formatInt(123)).toEqual("123");
  });
});

describe("formatFloat", () => {
  it("formats floats cleanly", () => {
    expect(formatFloat(0)).toEqual("0.00");
    expect(formatFloat(0.0000001)).toEqual("1.00e-7");
    expect(formatFloat(0.01)).toEqual("0.01");
    expect(formatFloat(0.1)).toEqual("0.10");
    expect(formatFloat(1234234.2)).toEqual("1.2M");
    expect(formatFloat(1230.8)).toEqual("1.2k");
    expect(formatFloat(123)).toEqual("123.00");
    expect(formatFloat(123.23)).toEqual("123.23");
    expect(formatFloat(12.23)).toEqual("12.23");
  });

  it("should truncate for values between 0.01 and 1", () => {
    expect(formatFloat(0.5555)).toEqual("0.55");
    expect(formatFloat(0.1111)).toEqual("0.11");
    expect(formatFloat(0.9999)).toEqual("0.99");
  });
});

describe("formatLatencyMs", () => {
  it("formats latency in milliseconds", () => {
    expect(formatLatencyMs(0)).toEqual("0ms");
    expect(formatLatencyMs(11)).toEqual("11ms");
    expect(formatLatencyMs(1 * ONE_SECOND_MS)).toEqual("1s");
    expect(formatLatencyMs(1 * ONE_SECOND_MS + 100)).toEqual("1.1s");
    expect(formatLatencyMs(1 * ONE_MINUTE_MS)).toEqual("1m");
    expect(formatLatencyMs(1 * ONE_HOUR_MS)).toEqual("1h");
    expect(formatLatencyMs(1 * ONE_HOUR_MS + 1 * ONE_MINUTE_MS)).toEqual(
      "1h 1m"
    );
    expect(formatLatencyMs(2 * ONE_HOUR_MS + 1 * ONE_SECOND_MS)).toEqual(
      "2h 1s"
    );
    expect(
      formatLatencyMs(1 * ONE_HOUR_MS + 15 * ONE_MINUTE_MS + 27 * ONE_SECOND_MS)
    ).toEqual("1h 15m 27s");
  });
});
