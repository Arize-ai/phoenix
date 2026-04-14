import { describe, expect, it } from "vitest";

import { parseNumber, trimToUndefined } from "../src/normalize";

describe("trimToUndefined", () => {
  it("returns undefined for blank input", () => {
    expect(trimToUndefined({ value: "   " })).toBeUndefined();
  });

  it("returns trimmed content for non-empty input", () => {
    expect(trimToUndefined({ value: " reviewer " })).toBe("reviewer");
  });
});

describe("parseNumber", () => {
  it("parses a trimmed numeric string", () => {
    expect(parseNumber({ rawValue: " 0.9 ", inputName: "--score" })).toBe(0.9);
  });

  it("throws a descriptive error for invalid numbers", () => {
    expect(() =>
      parseNumber({ rawValue: "not-a-number", inputName: "--score" })
    ).toThrow(
      "Invalid value for --score: not-a-number. Expected a finite number."
    );
  });

  it("renders blank strings as empty in error messages", () => {
    expect(() =>
      parseNumber({ rawValue: "   ", inputName: "--score" })
    ).toThrow("Invalid value for --score: <empty>. Expected a finite number.");
  });
});
