import type { Row, Table } from "@tanstack/react-table";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

import { addRowRangeToSelection } from "./addRowRangeToSelection";

/**
 * Tracks a row-selection anchor and applies shift-click range selection to the
 * current TanStack row model.
 *
 * @param params - hook configuration
 * @param params.resetKey - value whose identity change clears the range anchor
 */
export function useShiftClickRowSelection<TData>({
  resetKey,
}: {
  resetKey?: unknown;
} = {}) {
  const lastSelectedRowIdRef = useRef<string | null>(null);

  useEffect(() => {
    lastSelectedRowIdRef.current = null;
  }, [resetKey]);

  function selectRow({
    event,
    row,
    table,
  }: {
    event: MouseEvent;
    row: Row<TData>;
    table: Table<TData>;
  }) {
    if (!row.getCanSelect()) {
      return;
    }

    const rows = table.getRowModel().rows;
    const currentIndex = rows.findIndex((tableRow) => tableRow.id === row.id);
    const lastSelectedIndex =
      lastSelectedRowIdRef.current == null
        ? -1
        : rows.findIndex(
            (tableRow) => tableRow.id === lastSelectedRowIdRef.current
          );
    const hasRangeAnchor = lastSelectedIndex !== -1 && currentIndex !== -1;

    if (event.shiftKey && hasRangeAnchor) {
      table.setRowSelection((currentSelection) =>
        addRowRangeToSelection({
          rows,
          lastSelectedIndex,
          currentIndex,
          currentSelection,
        })
      );
    } else {
      row.toggleSelected();
    }

    lastSelectedRowIdRef.current = row.id;
  }

  return { selectRow };
}
