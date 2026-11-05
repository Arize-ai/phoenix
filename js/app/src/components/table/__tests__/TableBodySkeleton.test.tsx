import { useTable } from "@tanstack/react-table";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TableBodySkeleton } from "../TableBodySkeleton";
import type { ColumnDef } from "../tableFeatures";
import { appTableFeatures } from "../tableFeatures";

type Row = { name: string; count: number };

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "name", accessorKey: "name", size: 200 },
  {
    id: "count",
    header: "count",
    accessorKey: "count",
    size: 120,
    meta: { textAlign: "right" },
  },
];

function SkeletonTable({ rowCount }: { rowCount: number }) {
  const table = useTable({
    features: appTableFeatures,
    columns,
    data: [] as Row[],
  });
  return (
    <table>
      <TableBodySkeleton
        table={table}
        rowCount={rowCount}
        contentWidths={{ count: 32 }}
      />
    </table>
  );
}

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

function getCells(rowIndex: number): HTMLTableCellElement[] {
  const rows = container.querySelectorAll("tbody tr");
  return [...rows[rowIndex].querySelectorAll("td")];
}

describe("TableBodySkeleton", () => {
  it("renders the requested rows with a cell per column", () => {
    act(() => {
      root.render(<SkeletonTable rowCount={3} />);
    });
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(getCells(0)).toHaveLength(columns.length);
  });

  it("sizes each cell as the loaded table does", () => {
    act(() => {
      root.render(<SkeletonTable rowCount={1} />);
    });
    const [nameCell, countCell] = getCells(0);
    expect(nameCell.style.width).toBe("200px");
    expect(countCell.style.width).toBe("120px");
    expect(countCell.style.textAlign).toBe("right");
  });

  it("holds most of the column's size, or the content width it is given", () => {
    act(() => {
      root.render(<SkeletonTable rowCount={1} />);
    });
    const [nameCell, countCell] = getCells(0);
    const nameContent = nameCell.firstElementChild as HTMLElement;
    const countContent = countCell.firstElementChild as HTMLElement;
    expect(nameContent.style.width).toBe("170px");
    expect(countContent.style.width).toBe("32px");
    expect(countContent.dataset.align).toBe("right");
  });

  it("hides the placeholder rows from assistive technology", () => {
    act(() => {
      root.render(<SkeletonTable rowCount={2} />);
    });
    expect(container.querySelector("tbody")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });
});
