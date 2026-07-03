import { isVersionNewer, parseVersion } from "../versionUtils";

describe("parseVersion", () => {
  it("parses plain release versions", () => {
    expect(parseVersion("11.10.0")).toEqual([11, 10, 0]);
  });

  it("parses versions with a leading v", () => {
    expect(parseVersion("v11.10.0")).toEqual([11, 10, 0]);
  });

  it("discards pre-release suffixes", () => {
    expect(parseVersion("11.10.0rc1")).toEqual([11, 10, 0]);
    expect(parseVersion("12.0.0.dev3")).toEqual([12, 0, 0]);
  });

  it("returns null for non-numeric versions", () => {
    expect(parseVersion("unknown")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("isVersionNewer", () => {
  it("detects newer major, minor, and patch releases", () => {
    expect(isVersionNewer({ current: "11.9.0", latest: "12.0.0" })).toBe(true);
    expect(isVersionNewer({ current: "11.9.0", latest: "11.10.0" })).toBe(true);
    expect(isVersionNewer({ current: "11.9.0", latest: "11.9.1" })).toBe(true);
  });

  it("returns false for equal or older releases", () => {
    expect(isVersionNewer({ current: "11.9.0", latest: "11.9.0" })).toBe(false);
    expect(isVersionNewer({ current: "11.9.0", latest: "11.8.5" })).toBe(false);
    expect(isVersionNewer({ current: "12.0.0", latest: "11.10.0" })).toBe(
      false
    );
  });

  it("treats missing segments as zero", () => {
    expect(isVersionNewer({ current: "11.9", latest: "11.9.1" })).toBe(true);
    expect(isVersionNewer({ current: "11.9.0", latest: "11.9" })).toBe(false);
  });

  it("ignores pre-release suffixes so equal releases are not newer", () => {
    expect(isVersionNewer({ current: "11.9.0", latest: "11.9.0rc1" })).toBe(
      false
    );
  });

  it("returns false when either version cannot be parsed", () => {
    expect(isVersionNewer({ current: "unknown", latest: "11.9.0" })).toBe(
      false
    );
    expect(isVersionNewer({ current: "11.9.0", latest: "unknown" })).toBe(
      false
    );
  });
});
