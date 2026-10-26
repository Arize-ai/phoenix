import { useTable } from "@tanstack/react-table";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TableColumnHeader } from "../TableColumnHeader";
import type { ColumnDef } from "../tableFeatures";
import { appTableFeatures } from "../tableFeatures";

type Row = { key: string };

const columns: ColumnDef<Row>[] = [
  { id: "key", header: "Key", accessorKey: "key", size: 320 },
  { id: "value", header: "Value", accessorKey: "key", enableResizing: false },
];

const data: Row[] = [{ key: "llm.model_name" }];

function HeaderRow() {
  const table = useTable({
    features: appTableFeatures,
    columns,
    data,
    columnResizeMode: "onChange",
  });
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableColumnHeader key={header.id} header={header} />
            ))}
          </tr>
        ))}
      </thead>
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

function query(selector: string): Element {
  const element = container.querySelector(selector);
  if (element === null) {
    throw new Error(`no element matched ${selector}`);
  }
  return element;
}

function queryHeader(): HTMLTableCellElement {
  const element = query("th");
  if (!(element instanceof HTMLTableCellElement)) {
    throw new Error("the header cell is not a <th>");
  }
  return element;
}

describe("TableColumnHeader", () => {
  it("takes the width a drag of its resizer leaves the column at", () => {
    act(() => {
      root.render(<HeaderRow />);
    });
    const header = queryHeader();
    expect(header.style.width).toBe("320px");

    // the header object is the same before and after the drag, so a header
    // that doesn't subscribe to the table's sizing reports the starting width
    act(() => {
      query("div.resizer").dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 320 })
      );
    });
    act(() => {
      document.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 420 })
      );
    });
    expect(header.style.width).toBe("420px");

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: 420 })
      );
    });
    expect(header.style.width).toBe("420px");
  });

  it("reports the sort it is toggled to", () => {
    act(() => {
      root.render(<HeaderRow />);
    });
    const header = queryHeader();
    expect(header.getAttribute("aria-sort")).toBe("none");

    act(() => {
      query("div.sort").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(container.querySelector(".sort-icon")).not.toBeNull();
  });

  it("gives a column that cannot be resized no resizer", () => {
    act(() => {
      root.render(<HeaderRow />);
    });
    expect(container.querySelectorAll("div.resizer")).toHaveLength(1);
  });
});
