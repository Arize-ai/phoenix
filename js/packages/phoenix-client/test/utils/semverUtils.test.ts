import { describe, expect, it } from "vitest";

import {
  formatVersion,
  parseSemanticVersion,
  satisfiesMinVersion,
} from "../../src/utils/semverUtils";

describe("parseSemanticVersion", () => {
  it("parses a valid semver string", () => {
    expect(parseSemanticVersion("13.14.0")).toEqual([13, 14, 0]);
  });

  it("parses a version with leading/trailing whitespace", () => {
    expect(parseSemanticVersion("  1.2.3  ")).toEqual([1, 2, 3]);
  });

  it("parses a version with extra parts (ignores beyond 3)", () => {
    expect(parseSemanticVersion("1.2.3.4")).toEqual([1, 2, 3]);
  });

  it("returns null for fewer than 3 parts", () => {
    expect(parseSemanticVersion("1.2")).toBeNull();
  });

  it("returns null for non-numeric parts", () => {
    expect(parseSemanticVersion("a.b.c")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSemanticVersion("")).toBeNull();
  });

  it("returns null for NaN parts", () => {
    expect(parseSemanticVersion("1.2.NaN")).toBeNull();
  });

  it("returns null for Infinity parts", () => {
    expect(parseSemanticVersion("Infinity.0.0")).toBeNull();
  });

  it("returns null for empty segment", () => {
    expect(parseSemanticVersion("1..3")).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(parseSemanticVersion("-1.0.0")).toBeNull();
  });
});

describe("formatVersion", () => {
  it("formats a version triple as a dot-separated string", () => {
    expect(formatVersion([13, 14, 0])).toBe("13.14.0");
  });

  it("formats a zero version", () => {
    expect(formatVersion([0, 0, 0])).toBe("0.0.0");
  });
});

describe("satisfiesMinVersion", () => {
  it("returns true when versions are equal", () => {
    expect(
      satisfiesMinVersion({ version: [13, 14, 0], minVersion: [13, 14, 0] })
    ).toBe(true);
  });

  it("returns true when major is greater", () => {
    expect(
      satisfiesMinVersion({ version: [14, 0, 0], minVersion: [13, 14, 0] })
    ).toBe(true);
  });

  it("returns true when minor is greater", () => {
    expect(
      satisfiesMinVersion({ version: [13, 15, 0], minVersion: [13, 14, 0] })
    ).toBe(true);
  });

  it("returns true when patch is greater", () => {
    expect(
      satisfiesMinVersion({ version: [13, 14, 1], minVersion: [13, 14, 0] })
    ).toBe(true);
  });

  it("returns false when major is less", () => {
    expect(
      satisfiesMinVersion({ version: [12, 99, 99], minVersion: [13, 14, 0] })
    ).toBe(false);
  });

  it("returns false when minor is less", () => {
    expect(
      satisfiesMinVersion({ version: [13, 13, 99], minVersion: [13, 14, 0] })
    ).toBe(false);
  });

  it("returns false when patch is less", () => {
    expect(
      satisfiesMinVersion({ version: [13, 14, 0], minVersion: [13, 14, 1] })
    ).toBe(false);
  });
});
