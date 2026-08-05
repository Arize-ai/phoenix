import type { ColumnDef, ExpandedState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ReactElement } from "react";
import { act, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRowExpandColumn,
  getRowDetailsId,
  RowDetailsRow,
} from "../RowDetails";

type Dataset = { id: string; name: string };

const DATASETS: Dataset[] = [
  { id: "one", name: "first dataset" },
  { id: "two", name: "second dataset" },
];

const columns: ColumnDef<Dataset>[] = [
  createRowExpandColumn<Dataset>({ getRowLabel: (row) => row.original.name }),
  { id: "name", header: "name", accessorKey: "name" },
];

/**
 * The smallest table that renders the disclosure column beside a detail row,
 * standing in for the datasets table: rows do something of their own on click,
 * and expansion is keyed by the row's id rather than by its position.
 */
function DetailsTable({
  data = DATASETS,
  onRowClick,
}: {
  data?: Dataset[];
  onRowClick?: () => void;
}) {
  "use no memo";
  const [expanded, setExpanded] = useState<ExpandedState>({});
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<Dataset>({
    columns,
    data,
    state: { expanded },
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getRowId: (row) => row.id,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
  });
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => {
          const isExpanded = row.getIsExpanded();
          return (
            <Fragment key={row.id}>
              <tr data-expanded={isExpanded} onClick={onRowClick}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              {isExpanded ? (
                <RowDetailsRow rowId={row.id} colSpan={visibleColumnCount}>
                  <span>details for {row.original.name}</span>
                </RowDetailsRow>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
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

function render(element: ReactElement) {
  act(() => {
    root.render(element);
  });
}

function expandButtons(): Element[] {
  return Array.from(container.querySelectorAll("button[aria-expanded]"));
}

function expandButton(index: number): HTMLElement {
  const button = expandButtons().at(index);
  if (!(button instanceof HTMLElement)) {
    throw new Error(`no disclosure control at index ${index}`);
  }
  return button;
}

function expandedStates(): (string | null)[] {
  return expandButtons().map((button) => button.getAttribute("aria-expanded"));
}

function detailRows(): Element[] {
  return Array.from(container.querySelectorAll('tr[data-row="details"]'));
}

function onlyDetailRow(): Element {
  const rows = detailRows();
  if (rows.length !== 1) {
    throw new Error(`expected one detail row, found ${rows.length}`);
  }
  return rows[0];
}

function detailAreaId(detailRow: Element): string {
  const area = detailRow.querySelector("td > div");
  if (area == null) {
    throw new Error("the detail row has no detail area");
  }
  return area.id;
}

describe("row details", () => {
  it("gives every row a disclosure control that reads as collapsed", () => {
    render(<DetailsTable />);

    expect(expandedStates()).toEqual(["false", "false"]);
    expect(expandButton(0).getAttribute("aria-label")).toBe(
      "Toggle details for first dataset"
    );
    expect(detailRows()).toHaveLength(0);
  });

  it("reveals the detail area the control points at, spanning the row", () => {
    render(<DetailsTable />);

    act(() => {
      expandButton(0).click();
    });

    expect(expandedStates()).toEqual(["true", "false"]);
    const detailRow = onlyDetailRow();
    const detailCell = detailRow.querySelector("td");
    expect(detailCell?.getAttribute("colspan")).toBe("2");
    expect(detailRow.textContent).toContain("details for first dataset");
    // the control names the area it revealed, so assistive technology can
    // follow one to the other
    expect(detailAreaId(detailRow)).toBe(getRowDetailsId("one"));
    expect(expandButton(0).getAttribute("aria-controls")).toBe(
      getRowDetailsId("one")
    );
  });

  it("collapses the detail area again", () => {
    render(<DetailsTable />);

    act(() => {
      expandButton(0).click();
    });
    act(() => {
      expandButton(0).click();
    });

    expect(expandedStates()).toEqual(["false", "false"]);
    expect(detailRows()).toHaveLength(0);
  });

  it("does not trigger the row's own click when toggled", () => {
    const onRowClick = vi.fn();
    render(<DetailsTable onRowClick={onRowClick} />);

    act(() => {
      expandButton(0).click();
    });
    act(() => {
      expandButton(0).click();
    });

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps the same row expanded when sorting reorders the data", () => {
    render(<DetailsTable />);

    act(() => {
      expandButton(0).click();
    });
    // a sort is served by a refetch, which hands the table the same datasets
    // back in a different order
    render(<DetailsTable data={[...DATASETS].reverse()} />);

    expect(detailAreaId(onlyDetailRow())).toBe(getRowDetailsId("one"));
    // the expanded dataset moved to the second row, and its state moved with it
    expect(expandedStates()).toEqual(["false", "true"]);
  });
});
