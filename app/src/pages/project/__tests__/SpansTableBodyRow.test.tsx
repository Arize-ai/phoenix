import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpansTableBodyRow } from "../SpansTable";

type TestRow = {
  id: string;
  name: string;
  trace: { traceId: string };
};

const data: TestRow[] = [
  { id: "span-1", name: "first span", trace: { traceId: "trace-1" } },
  { id: "span-2", name: "second span", trace: { traceId: "trace-2" } },
];
const renderCell = vi.fn(({ row }: { row: { original: TestRow } }) => (
  <span>{row.original.name}</span>
));
function TestTable({
  isSelected,
  unrelatedValue,
}: {
  isSelected: boolean;
  unrelatedValue: number;
}) {
  "use no memo";
  const rowSelection: RowSelectionState = isSelected ? { "0": true } : {};
  const columns: ColumnDef<TestRow>[] = [
    { id: "name", accessorKey: "name", cell: renderCell },
  ];
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns,
    data,
    enableRowSelection: true,
    state: { rowSelection },
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <>
      <output>{unrelatedValue}</output>
      <table>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <SpansTableBodyRow
              key={row.id}
              row={row}
              columnRenderVersion="name:false"
              isCurrentRoute={false}
              isSelected={row.getIsSelected()}
              spanDetailsPath={`/spans/${row.original.id}`}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  renderCell.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderTestTable(props: {
  isSelected: boolean;
  unrelatedValue: number;
}) {
  act(() => {
    root.render(
      <MemoryRouter>
        <TestTable {...props} />
      </MemoryRouter>
    );
  });
}

describe("SpansTableBodyRow", () => {
  it("rerenders cells only in the row whose selection changes", () => {
    renderTestTable({ isSelected: false, unrelatedValue: 0 });
    expect(renderCell).toHaveBeenCalledTimes(2);

    renderTestTable({ isSelected: false, unrelatedValue: 1 });
    expect(renderCell).toHaveBeenCalledTimes(2);

    renderTestTable({ isSelected: true, unrelatedValue: 2 });
    expect(renderCell).toHaveBeenCalledTimes(3);
    expect(container.querySelectorAll('tr[aria-selected="true"]')).toHaveLength(
      1
    );
  });
});
