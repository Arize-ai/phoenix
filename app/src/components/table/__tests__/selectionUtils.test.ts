import { addRangeToSelection } from "../selectionUtils";

describe("addRangeToSelection", () => {
  const items = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
    { id: "e" },
  ];

  it("selects range from lower to higher index", () => {
    const result = addRangeToSelection(items, 1, 3, {});
    expect(result).toEqual({ b: true, c: true, d: true });
  });

  it("selects range from higher to lower index", () => {
    const result = addRangeToSelection(items, 3, 1, {});
    expect(result).toEqual({ b: true, c: true, d: true });
  });

  it("selects single item when indices are equal", () => {
    const result = addRangeToSelection(items, 2, 2, {});
    expect(result).toEqual({ c: true });
  });

  it("preserves existing selections", () => {
    const result = addRangeToSelection(items, 1, 2, { a: true, e: true });
    expect(result).toEqual({ a: true, b: true, c: true, e: true });
  });

  it("handles range at start of array", () => {
    const result = addRangeToSelection(items, 0, 2, {});
    expect(result).toEqual({ a: true, b: true, c: true });
  });

  it("handles range at end of array", () => {
    const result = addRangeToSelection(items, 2, 4, {});
    expect(result).toEqual({ c: true, d: true, e: true });
  });

  it("handles full array range", () => {
    const result = addRangeToSelection(items, 0, 4, {});
    expect(result).toEqual({ a: true, b: true, c: true, d: true, e: true });
  });

  it("does not mutate the original selection", () => {
    const originalSelection = { a: true };
    addRangeToSelection(items, 1, 2, originalSelection);
    expect(originalSelection).toEqual({ a: true });
  });
});
