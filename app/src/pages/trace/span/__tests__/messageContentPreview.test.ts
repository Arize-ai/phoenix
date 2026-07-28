import { describe, expect, it } from "vitest";

import { getMessageContentPreview } from "../messageContentPreview";

describe("getMessageContentPreview", () => {
  it("leaves short content unchanged", () => {
    expect(getMessageContentPreview({ content: "first\nsecond" })).toEqual({
      content: "first\nsecond",
      isTruncated: false,
    });
  });

  it("limits content by line count", () => {
    const content = Array.from(
      { length: 25 },
      (_, index) => `line ${index + 1}`
    ).join("\n");
    const preview = getMessageContentPreview({ content });

    expect(preview.isTruncated).toBe(true);
    expect(preview.content).toBe(
      `${Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n")}\n…`
    );
  });

  it("limits a long unbroken stream by character count", () => {
    const preview = getMessageContentPreview({ content: "a".repeat(5_000) });

    expect(preview.isTruncated).toBe(true);
    expect(preview.content).toBe(`${"a".repeat(4_000)}\n…`);
  });

  it("does not split a surrogate pair at the character boundary", () => {
    const preview = getMessageContentPreview({
      content: `${"a".repeat(3_999)}😀tail`,
    });

    expect(preview.content).toBe(`${"a".repeat(3_999)}\n…`);
  });
});
