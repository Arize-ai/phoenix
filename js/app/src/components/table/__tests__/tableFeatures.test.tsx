import { useTable } from "@tanstack/react-table";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ColumnDef } from "../tableFeatures";
import { appTableFeatures } from "../tableFeatures";

type Row = { value: unknown };

const columns: ColumnDef<Row>[] = [
  { id: "value", accessorFn: (row) => row.value },
];

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

/** Renders a table filtering its one column by `filterValue` and returns the values left. */
function renderFiltered(values: unknown[], filterValue: unknown): unknown[] {
  const results: unknown[][] = [];
  function FilteredTable() {
    const table = useTable({
      features: appTableFeatures,
      columns,
      data: values.map((value) => ({ value })),
      state: { columnFilters: [{ id: "value", value: filterValue }] },
    });
    results.push(table.getRowModel().rows.map((row) => row.original.value));
    return null;
  }
  act(() => {
    root.render(<FilteredTable />);
  });
  return results.at(-1)!;
}

const sharedObject = { a: 1 };

describe("appTableFeatures", () => {
  // v9 only resolves `filterFn: "auto"` (the default) to a function registered in
  // `filterFns`; an unregistered one makes the filtered row model skip the filter
  it.each([
    {
      filterFn: "includesString",
      values: ["BUILT_IN", "CUSTOM"],
      filterValue: "custom",
      expected: ["CUSTOM"],
    },
    {
      filterFn: "inNumberRange",
      values: [1, 5, 10],
      filterValue: [2, 8],
      expected: [5],
    },
    {
      filterFn: "equals (boolean)",
      values: [true, false],
      filterValue: true,
      expected: [true],
    },
    {
      filterFn: "equals (object)",
      values: [sharedObject, { a: 1 }],
      filterValue: sharedObject,
      expected: [sharedObject],
    },
    {
      filterFn: "arrIncludes",
      values: [["a", "b"], ["c"]],
      filterValue: ["c"],
      expected: [["c"]],
    },
    {
      filterFn: "inDateRange",
      values: [new Date("2026-01-01"), new Date("2026-06-01")],
      filterValue: [new Date("2026-05-01"), new Date("2026-07-01")],
      expected: [new Date("2026-06-01")],
    },
    {
      filterFn: "weakEquals",
      values: [BigInt(1), BigInt(2)],
      filterValue: "2",
      expected: [BigInt(2)],
    },
  ])(
    "filters a column whose auto filter fn is $filterFn",
    ({ values, filterValue, expected }) => {
      expect(renderFiltered(values, filterValue)).toEqual(expected);
    }
  );
});
