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
