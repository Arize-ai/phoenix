import {
  collapseCSVData,
  collapseRow,
  collapseRows,
  computeBucketCollapseConflicts,
  computeCollapsedKeys,
} from "../collapseUtils";

describe("computeCollapsedKeys", () => {
  describe("basic collapsing", () => {
    it("collapses a single key", () => {
      const result = computeCollapsedKeys(
        ["input", "id"],
        ["input"],
        [{ input: { question: "Hi", context: "Test" }, id: 1 }]
      );
      expect(result.collapsedKeys).toEqual(["question", "context", "id"]);
      expect(result.keysToCollapse).toEqual(["input"]);
      expect(result.excludedDueToConflicts.size).toBe(0);
    });

    it("collapses multiple keys", () => {
      const result = computeCollapsedKeys(
        ["input", "output"],
        ["input", "output"],
        [{ input: { question: "Hi" }, output: { answer: "Hello" } }]
      );
      expect(result.collapsedKeys).toEqual(["question", "answer"]);
      expect(result.keysToCollapse).toEqual(["input", "output"]);
      expect(result.excludedDueToConflicts.size).toBe(0);
    });

    it("preserves non-collapsible keys", () => {
      const result = computeCollapsedKeys(
        ["input", "id", "metadata"],
        ["input"], // Only input is collapsible
        [{ input: { question: "Hi" }, id: 1, metadata: { source: "test" } }]
      );
      expect(result.collapsedKeys).toEqual(["question", "id", "metadata"]);
      expect(result.keysToCollapse).toEqual(["input"]);
    });
  });

  describe("conflict detection", () => {
    it("detects conflict with original top-level key", () => {
      const result = computeCollapsedKeys(
        ["input", "question"], // "question" is a top-level key
        ["input"],
        [{ input: { question: "Hi" }, question: "existing" }]
      );
      // "input" cannot be collapsed because its child "question" conflicts with top-level "question"
      expect(result.keysToCollapse).toEqual([]);
      expect(result.excludedDueToConflicts.get("input")).toEqual(["question"]);
      expect(result.collapsedKeys).toEqual(["input", "question"]);
    });

    it("detects conflict between children of different parents", () => {
      const result = computeCollapsedKeys(
        ["input", "output"],
        ["input", "output"],
        [
          { input: { text: "Hi" }, output: { text: "Hello" } }, // Both have "text"
        ]
      );
      // First parent "input" succeeds, second "output" fails due to "text" conflict
      expect(result.keysToCollapse).toEqual(["input"]);
      expect(result.excludedDueToConflicts.get("output")).toEqual(["text"]);
      expect(result.collapsedKeys).toEqual(["text", "output"]);
    });

    it("handles multiple rows with varying keys", () => {
      const result = computeCollapsedKeys(
        ["input", "output"],
        ["input", "output"],
        [
          { input: { question: "Q1" }, output: { answer: "A1" } },
          { input: { question: "Q2", context: "C" }, output: { answer: "A2" } },
        ]
      );
      // Union of all child keys: input has question, context; output has answer
      expect(result.collapsedKeys).toContain("question");
      expect(result.collapsedKeys).toContain("context");
      expect(result.collapsedKeys).toContain("answer");
      expect(result.keysToCollapse).toEqual(["input", "output"]);
    });
  });

  describe("edge cases", () => {
    it("handles empty collapsibleKeys", () => {
      const result = computeCollapsedKeys(
        ["input", "output"],
        [],
        [{ input: { question: "Hi" }, output: { answer: "Hello" } }]
      );
      expect(result.collapsedKeys).toEqual(["input", "output"]);
      expect(result.keysToCollapse).toEqual([]);
      expect(result.excludedDueToConflicts.size).toBe(0);
    });

    it("handles empty previewRows", () => {
      const result = computeCollapsedKeys(["input", "output"], ["input"], []);
      // No data to extract children from
      expect(result.collapsedKeys).toEqual(["output"]);
      expect(result.keysToCollapse).toEqual(["input"]);
    });

    it("handles non-object values in collapsible keys", () => {
      const result = computeCollapsedKeys(
        ["input", "output"],
        ["input"],
        [{ input: "plain string", output: { answer: "Hello" } }]
      );
      // "input" has no object value, so no children are extracted
      expect(result.collapsedKeys).toEqual(["output"]);
      expect(result.keysToCollapse).toEqual(["input"]);
    });
  });
});

describe("computeBucketCollapseConflicts", () => {
  describe("bucket-aware conflict detection", () => {
    it("allows same child keys in different buckets", () => {
      // "question" in input bucket, "question" in output bucket -> no conflict
      const result = computeBucketCollapseConflicts(
        ["input", "output"],
        {
          input: ["input"],
          output: ["output"],
          metadata: [],
        },
        [{ input: { question: "Hi" }, output: { question: "Hello" } }]
      );
      // Both can collapse because they're in different buckets
      expect(result.keysToCollapse).toContain("input");
      expect(result.keysToCollapse).toContain("output");
      expect(result.conflicts.size).toBe(0);
    });

    it("detects conflict within same bucket", () => {
      // Both input and output assigned to INPUT bucket, both have "text" child
      const result = computeBucketCollapseConflicts(
        ["input", "output"],
        {
          input: ["input", "output"], // Both in same bucket
          output: [],
          metadata: [],
        },
        [{ input: { text: "Hi" }, output: { text: "Hello" } }]
      );
      // First one succeeds, second has conflict
      expect(result.keysToCollapse).toContain("input");
      expect(result.keysToCollapse).not.toContain("output");
      expect(result.conflicts.get("output")).toEqual(["text"]);
    });

    it("detects conflict with non-collapsible key in same bucket", () => {
      // "text" is a non-collapsible key in the same bucket as "input"
      const result = computeBucketCollapseConflicts(
        ["input"], // Only input is collapsible
        {
          input: ["input", "text"], // Both assigned to input bucket
          output: [],
          metadata: [],
        },
        [{ input: { text: "Hi" }, text: "plain" }]
      );
      // "input" cannot collapse because child "text" conflicts with bucket sibling "text"
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

    it("handles keys not assigned to any bucket", () => {
      // Collapsible key not in any bucket assignment
      const result = computeBucketCollapseConflicts(
        ["orphan"],
        { input: ["input"], output: [], metadata: [] },
        [{ orphan: { child: "value" }, input: { question: "Hi" } }]
      );
      // "orphan" can collapse (no bucket conflicts possible)
      expect(result.keysToCollapse).toContain("orphan");
    });
  });
});

describe("collapseRow", () => {
  it("collapses specified keys", () => {
    const result = collapseRow(
      { input: { question: "Hi" }, output: { answer: "Hello" }, id: 1 },
      ["input", "output"]
    );
    expect(result).toEqual({ question: "Hi", answer: "Hello", id: 1 });
  });

  it("keeps non-collapsed keys unchanged", () => {
    const result = collapseRow(
      { input: { question: "Hi" }, metadata: { source: "test" } },
      ["input"]
    );
    expect(result).toEqual({ question: "Hi", metadata: { source: "test" } });
  });

  it("handles non-object values in collapsed keys", () => {
    const result = collapseRow(
      { input: "plain string", output: { answer: "Hello" } },
      ["input", "output"]
    );
    // Non-object values are kept as-is
    expect(result).toEqual({ input: "plain string", answer: "Hello" });
  });

  it("handles empty keysToCollapse", () => {
    const row = { input: { question: "Hi" }, output: { answer: "Hello" } };
    const result = collapseRow(row, []);
    expect(result).toEqual(row);
  });
});

describe("collapseRows", () => {
  it("collapses all rows", () => {
    const result = collapseRows(
      [
        { input: { question: "Q1" }, output: { answer: "A1" } },
        { input: { question: "Q2" }, output: { answer: "A2" } },
      ],
      ["input", "output"]
    );
    expect(result).toEqual([
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2" },
    ]);
  });
});

describe("collapseCSVData", () => {
  it("collapses CSV columns with JSON values", () => {
    const result = collapseCSVData(
      ["id", "input", "output"],
      [
        ["1", '{"question": "Hi"}', '{"answer": "Hello"}'],
        ["2", '{"question": "Bye"}', '{"answer": "Goodbye"}'],
      ],
      ["input", "output"]
    );
    expect(result.collapsedColumns).toEqual(["id", "question", "answer"]);
    expect(result.collapsedRows).toEqual([
      { id: "1", question: "Hi", answer: "Hello" },
      { id: "2", question: "Bye", answer: "Goodbye" },
    ]);
  });

  it("handles non-JSON values gracefully", () => {
    const result = collapseCSVData(
      ["id", "input"],
      [
        ["1", "not json"],
        ["2", '{"question": "Hi"}'],
      ],
      ["input"]
    );
    // First row: "input" is not valid JSON, kept as string
    // Second row: "input" is valid JSON, collapsed
    expect(result.collapsedRows[0]).toEqual({ id: "1", input: "not json" });
    expect(result.collapsedRows[1]).toEqual({ id: "2", question: "Hi" });
  });

  it("handles empty rows", () => {
    const result = collapseCSVData(["id", "input"], [], ["input"]);
    expect(result.collapsedColumns).toEqual(["id"]);
    expect(result.collapsedRows).toEqual([]);
  });
});
