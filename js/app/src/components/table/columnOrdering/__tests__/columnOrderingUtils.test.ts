import {
  applySubsetColumnOrder,
  expandColumnOrderToLeafIds,
  getColumnDefId,
  mergeColumnOrder,
} from "../columnOrderingUtils";

describe("getColumnDefId", () => {
  it("resolves ids the same way tanstack table does", () => {
    expect(getColumnDefId({ id: "explicit", accessorKey: "a.b" })).toBe(
      "explicit"
    );
    expect(getColumnDefId({ accessorKey: "input.value" })).toBe("input_value");
    expect(getColumnDefId({ header: "my column" })).toBe("my column");
    expect(getColumnDefId({ header: () => null })).toBeNull();
  });
});

describe("mergeColumnOrder", () => {
  it("drops stale ids and appends unknown columns at the end", () => {
    expect(
      mergeColumnOrder({
        columnOrder: ["b", "removed", "a"],
        columnIds: ["a", "b", "c", "d"],
      })
    ).toEqual(["b", "a", "c", "d"]);
  });

  it("returns the natural order when there is no persisted order", () => {
    expect(
      mergeColumnOrder({ columnOrder: [], columnIds: ["a", "b"] })
    ).toEqual(["a", "b"]);
  });

  it("deduplicates persisted and available column ids", () => {
    expect(
      mergeColumnOrder({
        columnOrder: ["b", "b"],
        columnIds: ["a", "b", "a"],
      })
    ).toEqual(["b", "a"]);
  });
});

describe("expandColumnOrderToLeafIds", () => {
  const defs = [
    { accessorKey: "input.value" },
    {
      header: "quality",
      columns: [{ id: "quality-label" }, { id: "quality-score" }],
    },
    { id: "startTime" },
  ];

  it("expands group columns into contiguous leaf ids", () => {
    expect(
      expandColumnOrderToLeafIds(["quality", "startTime", "input_value"], defs)
    ).toEqual(["quality-label", "quality-score", "startTime", "input_value"]);
  });

  it("passes through ids that are not in the defs", () => {
    expect(expandColumnOrderToLeafIds(["unknown"], defs)).toEqual(["unknown"]);
  });
});

describe("applySubsetColumnOrder", () => {
  it("reorders the subset while other columns keep their slots", () => {
    expect(
      applySubsetColumnOrder({
        columnOrder: ["a", "group", "b", "c"],
        orderedSubset: ["c", "a", "b"],
      })
    ).toEqual(["c", "group", "a", "b"]);
  });

  it("is a no-op when the subset order is unchanged", () => {
    expect(
      applySubsetColumnOrder({
        columnOrder: ["a", "b", "c"],
        orderedSubset: ["a", "c"],
      })
    ).toEqual(["a", "b", "c"]);
  });
});
