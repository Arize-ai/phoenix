import type { RowSelectionState } from "@tanstack/react-table";

type SelectableRow = {
  id: string;
  depth: number;
  getCanSelect: () => boolean;
};

/**
 * Given an ordered row model and a selection range, returns a new selection
 * object that includes all selectable rows in the range.
 *
 * Rows are restricted to the same depth as the clicked row so that, in
 * hierarchical tables (e.g. an expanded trace's child spans), a range
 * selected between two top-level rows does not also sweep in nested rows
 * that happen to be rendered in between.
 *
 * @param params - range selection parameters
 * @param params.rows - ordered TanStack rows from the current row model
 * @param params.lastSelectedIndex - index of the previously selected row
 * @param params.currentIndex - index of the clicked row
 * @param params.currentSelection - current TanStack row selection state
 * @returns A new selection object with all selectable rows in the range selected
 */
export function addRowRangeToSelection<TRow extends SelectableRow>({
  rows,
  lastSelectedIndex,
  currentIndex,
  currentSelection,
}: {
  rows: TRow[];
  lastSelectedIndex: number;
  currentIndex: number;
  currentSelection: RowSelectionState;
}): RowSelectionState {
  const start = Math.min(lastSelectedIndex, currentIndex);
  const end = Math.max(lastSelectedIndex, currentIndex);
  const depth = rows[currentIndex]?.depth ?? 0;
  const rowsToSelect = rows
    .slice(start, end + 1)
    .filter((row) => row.depth === depth);

  const newSelection = { ...currentSelection };
  rowsToSelect.forEach((row) => {
    if (row.getCanSelect()) {
      newSelection[row.id] = true;
    }
  });
  return newSelection;
}
