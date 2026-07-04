import { addRowRangeToSelection } from "../addRowRangeToSelection";

describe("addRowRangeToSelection", () => {
  const rows = [
    { id: "0", getCanSelect: () => true },
    { id: "1", getCanSelect: () => true },
    { id: "2", getCanSelect: () => true },
    { id: "3", getCanSelect: () => true },
  ];

  it("selects range from lower to higher index", () => {
    const result = addRowRangeToSelection({
      rows,
      lastSelectedIndex: 1,
      currentIndex: 3,
      currentSelection: {},
    });

    expect(result).toEqual({ "1": true, "2": true, "3": true });
  });

  it("selects range from higher to lower index", () => {
    const result = addRowRangeToSelection({
      rows,
      lastSelectedIndex: 3,
      currentIndex: 1,
      currentSelection: {},
    });

    expect(result).toEqual({ "1": true, "2": true, "3": true });
  });

  it("selects rows by row id instead of positional index", () => {
    const result = addRowRangeToSelection({
      rows: [
        { id: "row-a", getCanSelect: () => true },
        { id: "row-b", getCanSelect: () => true },
        { id: "row-c", getCanSelect: () => true },
      ],
      lastSelectedIndex: 1,
      currentIndex: 2,
      currentSelection: {},
    });

    expect(result).toEqual({ "row-b": true, "row-c": true });
  });

  it("skips rows that cannot be selected", () => {
    const result = addRowRangeToSelection({
      rows: [
        { id: "0", getCanSelect: () => true },
        { id: "1", getCanSelect: () => false },
        { id: "2", getCanSelect: () => true },
      ],
      lastSelectedIndex: 0,
      currentIndex: 2,
      currentSelection: {},
    });

    expect(result).toEqual({ "0": true, "2": true });
  });

  it("preserves existing selections", () => {
    const result = addRowRangeToSelection({
      rows,
      lastSelectedIndex: 1,
      currentIndex: 2,
      currentSelection: { "0": true },
    });

    expect(result).toEqual({ "0": true, "1": true, "2": true });
  });

  it("does not mutate the original selection", () => {
    const originalSelection = { "0": true };
    addRowRangeToSelection({
      rows,
      lastSelectedIndex: 1,
      currentIndex: 2,
      currentSelection: originalSelection,
    });

    expect(originalSelection).toEqual({ "0": true });
  });

  it("skips nested rows rendered between top-level rows", () => {
    // Simulates a table with subrows, e.g. an expanded trace's child spans
    // rendered inline between two top-level rows.
    const result = addRowRangeToSelection({
      rows: [
        { id: "trace-0", getCanSelect: () => true },
        { id: "trace-0.span-0", parentId: "trace-0", getCanSelect: () => true },
        { id: "trace-0.span-1", parentId: "trace-0", getCanSelect: () => true },
        { id: "trace-1", getCanSelect: () => true },
        { id: "trace-2", getCanSelect: () => true },
      ],
      lastSelectedIndex: 0,
      currentIndex: 4,
      currentSelection: {},
    });

    expect(result).toEqual({
      "trace-0": true,
      "trace-1": true,
      "trace-2": true,
    });
  });

  it("selects nested rows when the clicked row is itself nested", () => {
    const result = addRowRangeToSelection({
      rows: [
        { id: "trace-0", getCanSelect: () => true },
        { id: "trace-0.span-0", parentId: "trace-0", getCanSelect: () => true },
        { id: "trace-0.span-1", parentId: "trace-0", getCanSelect: () => true },
        { id: "trace-1", getCanSelect: () => true },
      ],
      lastSelectedIndex: 1,
      currentIndex: 2,
      currentSelection: {},
    });

    expect(result).toEqual({
      "trace-0.span-0": true,
      "trace-0.span-1": true,
    });
  });

  it("skips same-depth children of unrelated parents in between", () => {
    // Ranging from a child span of trace-2 to a child span of trace-0 must
    // not sweep in trace-1's child spans, even though they share a depth.
    const result = addRowRangeToSelection({
      rows: [
        { id: "trace-0", getCanSelect: () => true },
        { id: "trace-0.span-0", parentId: "trace-0", getCanSelect: () => true },
        { id: "trace-1", getCanSelect: () => true },
        { id: "trace-1.span-0", parentId: "trace-1", getCanSelect: () => true },
        { id: "trace-2", getCanSelect: () => true },
        { id: "trace-2.span-0", parentId: "trace-2", getCanSelect: () => true },
      ],
      lastSelectedIndex: 5,
      currentIndex: 1,
      currentSelection: {},
    });

    expect(result).toEqual({ "trace-0.span-0": true });
  });

  it("selects only siblings of the clicked row when the anchor row has a different parent", () => {
    // Anchor is a top-level trace; the clicked row is a nested span. The
    // range is keyed to the clicked row's parent, so only its siblings in
    // the range are selected — not spans of other traces in between.
    const result = addRowRangeToSelection({
      rows: [
        { id: "trace-0", getCanSelect: () => true },
        { id: "trace-0.span-0", parentId: "trace-0", getCanSelect: () => true },
        { id: "trace-1", getCanSelect: () => true },
        { id: "trace-1.span-0", parentId: "trace-1", getCanSelect: () => true },
        { id: "trace-1.span-1", parentId: "trace-1", getCanSelect: () => true },
      ],
      lastSelectedIndex: 0,
      currentIndex: 4,
      currentSelection: {},
    });

    expect(result).toEqual({
      "trace-1.span-0": true,
      "trace-1.span-1": true,
    });
  });
});
