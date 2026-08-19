/**
 * Returns a new array with `item` removed if present, or appended if absent.
 *
 * Useful for toggling a value in a multi-select set (e.g. selected filter ids).
 */
export function toggleArrayItem<T>(array: readonly T[], item: T): T[] {
  return array.includes(item)
    ? array.filter((existing) => existing !== item)
    : [...array, item];
}
