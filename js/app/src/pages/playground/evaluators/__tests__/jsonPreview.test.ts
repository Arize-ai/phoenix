import { describe, expect, it } from "vitest";

import { truncateJsonPreview } from "../results/jsonPreview";

describe("truncateJsonPreview", () => {
  it("returns short documents untouched", () => {
    expect(truncateJsonPreview('{\n  "a": 1\n}', 100)).toEqual({
      text: '{\n  "a": 1\n}',
      isTruncated: false,
    });
  });

  it("cuts at a line break and says how much is left", () => {
    const json = JSON.stringify(
      { a: "x".repeat(20), b: "y".repeat(50) },
      null,
      2
    );
    const preview = truncateJsonPreview(json, 40);
    expect(preview.isTruncated).toBe(true);
    expect(preview.text.split("\n").slice(0, 2)).toEqual(
      json.split("\n").slice(0, 2)
    );
    expect(preview.text).toMatch(/\n… \d+ more characters\./);
  });

  it("cuts inside a single huge line rather than showing nothing", () => {
    const json = `{\n  "a": "${"x".repeat(500)}"\n}`;
    const preview = truncateJsonPreview(json, 100);
    expect(preview.text.split("\n")[1]).toHaveLength(100 - 2);
  });
});
