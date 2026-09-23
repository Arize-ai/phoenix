import { addRowRangeToSelection } from "../addRowRangeToSelection";

describe("addRowRangeToSelection", () => {
  const rows = [
    { id: "0", depth: 0, getCanSelect: () => true },
    { id: "1", depth: 0, getCanSelect: () => true },
    { id: "2", depth: 0, getCanSelect: () => true },
    { id: "3", depth: 0, getCanSelect: () => true },
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

  it("selects rows by row id instead of original data id", () => {
    const result = addRowRangeToSelection({
      rows,
      lastSelectedIndex: 1,
      currentIndex: 3,
      currentSelection: {},
    });

    expect(result).toEqual({ "1": true, "2": true, "3": true });
  });

  it("skips rows that cannot be selected", () => {
    const result = addRowRangeToSelection({
      rows: [
        { id: "0", depth: 0, getCanSelect: () => true },
        { id: "1", depth: 0, getCanSelect: () => false },
        { id: "2", depth: 0, getCanSelect: () => true },
      ],
      lastSelectedIndex: 0,
      currentIndex: 2,
      currentSelection: {},
    });

    expect(result).toEqual({ "0": true, "2": true });
  });

  it("preserves existing row selections", () => {
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

  it("skips nested rows of a different depth than the clicked row", () => {
    // Simulates a table with subrows, e.g. an expanded trace's child spans
    // rendered inline between two top-level rows.
    const result = addRowRangeToSelection({
      rows: [
        { id: "trace-0", depth: 0, getCanSelect: () => true },
        { id: "trace-0-span-0", depth: 1, getCanSelect: () => true },
        { id: "trace-0-span-1", depth: 1, getCanSelect: () => true },
        { id: "trace-1", depth: 0, getCanSelect: () => true },
        { id: "trace-2", depth: 0, getCanSelect: () => true },
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
        { id: "trace-0", depth: 0, getCanSelect: () => true },
        { id: "trace-0-span-0", depth: 1, getCanSelect: () => true },
        { id: "trace-0-span-1", depth: 1, getCanSelect: () => true },
        { id: "trace-1", depth: 0, getCanSelect: () => true },
      ],
      lastSelectedIndex: 1,
      currentIndex: 2,
      currentSelection: {},
    });

    expect(result).toEqual({
      "trace-0-span-0": true,
      "trace-0-span-1": true,
    });
  });
});
