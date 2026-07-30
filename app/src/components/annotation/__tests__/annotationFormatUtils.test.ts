import { describe, expect, it } from "vitest";

import { formatAnnotationScore } from "@phoenix/components/annotation/annotationFormatUtils";

describe("formatAnnotationScore", () => {
  it.each([
    [0, "0"],
    [1, "1"],
    [0.5, "0.5"],
    [0.23, "0.23"],
    [1.2, "1.2"],
    [0.9999, "0.99"],
  ])("formats %s as %s", (score, expected) => {
    expect(formatAnnotationScore(score)).toBe(expected);
  });
});
