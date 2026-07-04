import type {
  ColumnPinningState,
  RowSelectionState,
} from "@tanstack/react-table";

export const CHECKBOX_COLUMN_ID = "select";

export const CHECKBOX_COLUMN_PINNING = {
  left: [CHECKBOX_COLUMN_ID],
} satisfies ColumnPinningState;

type SelectableRow = {
  id: string;
  getCanSelect: () => boolean;
};

/**
 * Given an array of items with IDs and a selection range,
 * returns a new selection object that includes all items in the range.
 *
 * @param items - Array of items, each with an `id` property
 * @param lastSelectedIndex - The index of the previously selected item (anchor point)
 * @param currentIndex - The index of the currently clicked item
 * @param currentSelection - The current selection state
 * @returns A new selection object with all items in the range selected
 */
export function addRangeToSelection<T extends { id: string }>(
  items: T[],
  lastSelectedIndex: number,
  currentIndex: number,
  currentSelection: Record<string, boolean>
): Record<string, boolean> {
  const start = Math.min(lastSelectedIndex, currentIndex);
  const end = Math.max(lastSelectedIndex, currentIndex);
  const itemsToSelect = items.slice(start, end + 1);

  const newSelection = { ...currentSelection };
  itemsToSelect.forEach((item) => {
    newSelection[item.id] = true;
  });
  return newSelection;
}

/**
 * Given an ordered row model and a selection range, returns a new selection
 * object that includes all selectable rows in the range.
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
  const rowsToSelect = rows.slice(start, end + 1);

  const newSelection = { ...currentSelection };
  rowsToSelect.forEach((row) => {
    if (row.getCanSelect()) {
      newSelection[row.id] = true;
    }
  });
  return newSelection;
}
