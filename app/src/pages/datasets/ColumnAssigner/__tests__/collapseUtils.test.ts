import { computeBucketCollapseConflicts } from "../collapseUtils";

describe("computeBucketCollapseConflicts", () => {
  describe("assignment-first flattening", () => {
    it("allows same child keys in different buckets", () => {
      const result = computeBucketCollapseConflicts(
        ["input", "output"],
        {
          input: ["input"],
          output: ["output"],
          metadata: [],
        },
        [{ input: { question: "Hi" }, output: { question: "Hello" } }]
      );
      expect(result.keysToCollapse).toContain("input");
      expect(result.keysToCollapse).toContain("output");
      expect(result.conflicts.size).toBe(0);
    });

    it("ignores unused top-level keys outside the assigned bucket", () => {
      const result = computeBucketCollapseConflicts(
        ["input"],
        {
          input: ["input"],
          output: [],
          metadata: [],
        },
        [{ input: { text: "Hi" }, text: "plain" }]
      );
      expect(result.keysToCollapse).toContain("input");
      expect(result.conflicts.size).toBe(0);
    });

    it("detects conflict within same bucket", () => {
      const result = computeBucketCollapseConflicts(
        ["input", "output"],
        {
          input: ["input", "output"], // Both in same bucket
          output: [],
          metadata: [],
        },
        [{ input: { text: "Hi" }, output: { text: "Hello" } }]
      );
      expect(result.keysToCollapse).toContain("input");
      expect(result.keysToCollapse).not.toContain("output");
      expect(result.conflicts.get("output")).toEqual(["text"]);
    });

    it("detects conflict with a selected sibling key in the same bucket", () => {
      const result = computeBucketCollapseConflicts(
        ["input"],
        {
          input: ["input", "text"],
          output: [],
          metadata: [],
        },
        [{ input: { text: "Hi" }, text: "plain" }]
      );
      expect(result.keysToCollapse).not.toContain("input");
      expect(result.conflicts.get("input")).toEqual(["text"]);
    });
  });

  describe("edge cases", () => {
    it("handles empty collapsibleKeys", () => {
      const result = computeBucketCollapseConflicts(
        [],
        { input: ["input"], output: ["output"], metadata: [] },
        [{ input: { question: "Hi" }, output: { answer: "Hello" } }]
      );
      expect(result.keysToCollapse).toEqual([]);
      expect(result.conflicts.size).toBe(0);
    });

    it("does not collapse keys not assigned to input, output, or metadata", () => {
      const result = computeBucketCollapseConflicts(
        ["orphan"],
        { input: ["input"], output: [], metadata: [] },
        [{ orphan: { child: "value" }, input: { question: "Hi" } }]
      );
      expect(result.keysToCollapse).toEqual([]);
      expect(result.conflicts.size).toBe(0);
    });
  });
});
