import type { ColumnDef } from "@tanstack/react-table";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { CalibrationResultsTable } from "../CalibrationResultsTable";

it("keeps resized widths and mounted cells when loading or adding a column", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const columns: ColumnDef<unknown>[] = [
    { id: "index", header: "#", size: 48, enableResizing: false },
    { id: "example", header: "Example", size: 520, minSize: 280 },
  ];
  const body = (
    <tbody>
      <tr>
        <td>1</td>
        <td>Example input</td>
      </tr>
    </tbody>
  );
  const render = ({
    nextColumns = columns,
    isLoading = false,
  }: {
    nextColumns?: ColumnDef<unknown>[];
    isLoading?: boolean;
  } = {}) => {
    act(() =>
      root.render(
        <CalibrationResultsTable
          columns={nextColumns}
          columnVisibility={{}}
          onColumnVisibilityChange={() => {}}
          isLoading={isLoading}
        >
          {body}
        </CalibrationResultsTable>
      )
    );
  };
  try {
    render();
    const row = container.querySelector("tbody tr");
    const header = container.querySelectorAll("th")[1];
    const handle = header.querySelector(".resizer")!;
    expect(container.querySelectorAll(".resizer")).toHaveLength(1);
    act(() =>
      handle.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 520 })
      )
    );
    act(() =>
      document.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 640 })
      )
    );
    act(() =>
      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: 640 })
      )
    );
    expect(header.style.width).toBe("640px");
    expect(container.querySelector("tbody tr")).toBe(row);
    render({ isLoading: true });
    render({
      nextColumns: [...columns, { id: "A", header: "Evaluator A", size: 240 }],
    });
    expect(container.querySelectorAll("th")[1].style.width).toBe("640px");
    expect(container.querySelectorAll(".resizer")).toHaveLength(2);
    expect(container.querySelector("tbody tr")).toBe(row);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
