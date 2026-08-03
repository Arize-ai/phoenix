import { describe, expect, it } from "vitest";

import { toContentPreview, toToolCallsPreview } from "../contentPreviewUtils";

describe("toContentPreview", () => {
  it("returns plain text unquoted", () => {
    expect(toContentPreview("Hi, I am your friendly assistant")).toBe(
      "Hi, I am your friendly assistant"
    );
  });

  it("collapses newlines and runs of whitespace onto one line", () => {
    expect(toContentPreview("first line\n\n  second\tline  ")).toBe(
      "first line second line"
    );
  });

  it("truncates past the max length with an ellipsis", () => {
    expect(toContentPreview("abcdefghij", { maxLength: 4 })).toBe("abcd…");
  });

  it("does not leave a trailing space before the ellipsis", () => {
    expect(toContentPreview("ab cdefgh", { maxLength: 3 })).toBe("ab…");
  });

  it("keeps content that is exactly the max length whole", () => {
    expect(toContentPreview("abcd", { maxLength: 4 })).toBe("abcd");
  });

  it("previews structured content as JSON", () => {
    expect(toContentPreview({ city: "SF" })).toBe('{ "city": "SF" }');
  });

  it("returns undefined for nothing worth showing", () => {
    expect(toContentPreview(undefined)).toBeUndefined();
    expect(toContentPreview(null)).toBeUndefined();
    expect(toContentPreview("")).toBeUndefined();
    expect(toContentPreview("   \n  ")).toBeUndefined();
  });
});

describe("toToolCallsPreview", () => {
  it("names the tools that were called", () => {
    expect(
      toToolCallsPreview([{ name: "get_weather" }, { name: "get_time" }])
    ).toBe("get_weather(), get_time()");
  });

  it("skips tool calls that have no name", () => {
    expect(
      toToolCallsPreview([{ name: null }, { name: "" }, { name: "search" }])
    ).toBe("search()");
  });

  it("returns undefined when nothing was called", () => {
    expect(toToolCallsPreview([])).toBeUndefined();
    expect(toToolCallsPreview([{ name: undefined }])).toBeUndefined();
  });
});
