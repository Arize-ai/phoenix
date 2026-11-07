import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  UseColumnOrderProps,
  UseColumnOrderResult,
} from "../useColumnOrder";
import { useColumnOrder } from "../useColumnOrder";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

/** Renders the hook with the given props and returns every result it produced. */
function renderUseColumnOrder(props: UseColumnOrderProps) {
  const results: UseColumnOrderResult[] = [];
  function Harness(harnessProps: UseColumnOrderProps) {
    results.push(useColumnOrder(harnessProps));
    return null;
  }
  act(() => {
    root.render(createElement(Harness, props));
  });
  return {
    results,
    rerender: (nextProps: UseColumnOrderProps) => {
      act(() => {
        root.render(createElement(Harness, nextProps));
      });
    },
  };
}

describe("useColumnOrder", () => {
  it("preserves temporarily absent column ids across visible header drags", () => {
    const onColumnOrderChange = vi.fn();
    const { results } = renderUseColumnOrder({
      columns: [{ id: "a" }, { id: "b" }],
      columnOrder: ["a", "hidden-annotation", "b"],
      onColumnOrderChange,
      columnVisibility: {},
    });
    const result = results.at(-1)!;

    expect(result.leafColumnOrder).toEqual(["a", "b"]);
    expect(result.visibleColumnOrder).toEqual(["a", "b"]);

    result.onVisibleColumnOrderChange(["b", "a"]);

    expect(onColumnOrderChange).toHaveBeenCalledWith([
      "b",
      "hidden-annotation",
      "a",
    ]);
  });

  it("keeps the leaf order's identity when its inputs are unchanged", () => {
    // tanstack's v9 store compares state slices by reference, so a new
    // `leafColumnOrder` array on every render reads as a state change
    const props: UseColumnOrderProps = {
      columns: [{ id: "a" }, { id: "b" }],
      columnOrder: [],
      onColumnOrderChange: vi.fn(),
      columnVisibility: {},
    };
    const { results, rerender } = renderUseColumnOrder({
      ...props,
      nonOrderableColumnIds: ["a"],
    });
    rerender({ ...props, nonOrderableColumnIds: ["a"] });

    expect(results.length).toBeGreaterThan(1);
    expect(results.at(-1)!.leafColumnOrder).toBe(results[0]!.leafColumnOrder);
    expect(results.at(-1)!.visibleColumnOrder).toBe(
      results[0]!.visibleColumnOrder
    );
  });
});
