import { describe, expect, it } from "vitest";

import { getEvaluatorCopyName } from "../evaluatorCopyName";

describe("getEvaluatorCopyName", () => {
  it("appends _copy when free", () => {
    expect(getEvaluatorCopyName("quality", ["quality"])).toBe("quality_copy");
  });

  it("numbers further copies past the taken ones", () => {
    expect(
      getEvaluatorCopyName("quality ", [
        "quality",
        "quality_copy",
        "quality_copy_1",
        "quality_copy_3",
      ])
    ).toBe("quality_copy_2");
  });
});
