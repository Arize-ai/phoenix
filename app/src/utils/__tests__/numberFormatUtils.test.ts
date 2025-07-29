import { formatFloat, formatInt, formatLatencyMs } from "../numberFormatUtils";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

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
});

describe("formatLatencyMs", () => {
  it("formats latency in milliseconds", () => {
    expect(formatLatencyMs(0)).toEqual("0ms");
    expect(formatLatencyMs(11)).toEqual("11ms");
    expect(formatLatencyMs(1 * MS_PER_SECOND)).toEqual("1s");
    expect(formatLatencyMs(1 * MS_PER_SECOND + 100)).toEqual("1.1s");
    expect(formatLatencyMs(1 * MS_PER_MINUTE)).toEqual("1m");
    expect(formatLatencyMs(1 * MS_PER_HOUR)).toEqual("1h");
    expect(formatLatencyMs(1 * MS_PER_HOUR + 1 * MS_PER_MINUTE)).toEqual(
      "1h 1m"
    );
    expect(formatLatencyMs(2 * MS_PER_HOUR + 1 * MS_PER_SECOND)).toEqual(
      "2h 1s"
    );
    expect(
      formatLatencyMs(1 * MS_PER_HOUR + 15 * MS_PER_MINUTE + 27 * MS_PER_SECOND)
    ).toEqual("1h 15m 27s");
  });
});
