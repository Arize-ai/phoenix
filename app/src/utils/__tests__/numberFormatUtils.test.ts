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
    expect(formatFloat(0.01)).toEqual("0.01");
    expect(formatFloat(0.1)).toEqual("0.1");
    expect(formatFloat(1234234.2)).toEqual("1.2M");
    expect(formatFloat(1230.8)).toEqual("1.2k");
    expect(formatFloat(123)).toEqual("123");
    expect(formatFloat(123.23)).toEqual("123");
    expect(formatFloat(12.23)).toEqual("12.2");
  });
});
