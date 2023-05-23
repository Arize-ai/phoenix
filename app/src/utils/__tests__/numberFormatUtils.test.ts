import { formatFloat, formatInt } from "../numberFormatUtils";

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
