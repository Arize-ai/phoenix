import { useColumnOrder } from "../useColumnOrder";

describe("useColumnOrder", () => {
  it("preserves temporarily absent column ids across visible header drags", () => {
    const onColumnOrderChange = vi.fn();
    const result = useColumnOrder({
      columns: [{ id: "a" }, { id: "b" }],
      columnOrder: ["a", "hidden-annotation", "b"],
      onColumnOrderChange,
      columnVisibility: {},
    });

    expect(result.leafColumnOrder).toEqual(["a", "b"]);
    expect(result.visibleColumnOrder).toEqual(["a", "b"]);

    result.onVisibleColumnOrderChange(["b", "a"]);

    expect(onColumnOrderChange).toHaveBeenCalledWith([
      "b",
      "hidden-annotation",
      "a",
    ]);
  });
});
