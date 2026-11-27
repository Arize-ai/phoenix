/**
 * One stop in the slideover's previous/next order. The grid has one stop per
 * example; the list has one per base run, so a stop there also names the
 * base repetition.
 */
export type ExperimentCompareNavigationItem = {
  exampleId: string;
  /** The example's user-facing ID, when it has one */
  exampleExternalId?: string | null;
  /** The base repetition this stop shows, when the stop is a single run */
  baseRepetitionNumber?: number;
};

export type ExampleNavigation =
  | { type: "select"; item: ExperimentCompareNavigationItem }
  /** The neighbor is on a page that has not been fetched yet */
  | { type: "load-more" }
  | { type: "none" };

/**
 * The index of the open stop among the loaded ones, or -1 when it is not
 * loaded. A stop that names a repetition matches only that repetition; when
 * no stop matches the repetition, the first stop for the example is used.
 * @param params.items - the loaded stops, in display order
 * @param params.selectedExampleId - the open example
 * @param params.baseRepetitionNumber - the base repetition shown
 */
export function findNavigationItemIndex({
  items,
  selectedExampleId,
  baseRepetitionNumber,
}: {
  items: readonly ExperimentCompareNavigationItem[];
  selectedExampleId: string | null;
  baseRepetitionNumber: number;
}): number {
  if (selectedExampleId == null) {
    return -1;
  }
  const exactIndex = items.findIndex(
    (item) =>
      item.exampleId === selectedExampleId &&
      (item.baseRepetitionNumber == null ||
        item.baseRepetitionNumber === baseRepetitionNumber)
  );
  if (exactIndex !== -1) {
    return exactIndex;
  }
  return items.findIndex((item) => item.exampleId === selectedExampleId);
}

/**
 * What moving to a stop does: select it when it is loaded, fetch the next
 * page when it is just past the loaded stops, or nothing at either end of
 * the list.
 * @param params.items - the loaded stops, in display order
 * @param params.targetIndex - the index to move to; one past the loaded stops asks for the next page
 * @param params.hasMoreItems - whether the server has stops past the loaded ones
 */
export function resolveExampleNavigation({
  items,
  targetIndex,
  hasMoreItems,
}: {
  items: readonly ExperimentCompareNavigationItem[];
  targetIndex: number;
  hasMoreItems: boolean;
}): ExampleNavigation {
  if (targetIndex < 0) {
    return { type: "none" };
  }
  const item = items[targetIndex];
  if (item != null) {
    return { type: "select", item };
  }
  return hasMoreItems ? { type: "load-more" } : { type: "none" };
}

/**
 * The number of examples an experiment ran over, from its expected run count
 * (examples in scope times repetitions).
 */
export function getExperimentExampleCount({
  expectedRunCount,
  repetitions,
}: {
  expectedRunCount: number;
  repetitions: number;
}): number {
  return Math.round(expectedRunCount / Math.max(repetitions, 1));
}

const UNKNOWN_POSITION_TEXT = "–";

/**
 * The header's position text, e.g. `7 / 312`. Without a server total the
 * loaded count stands in, with a `+` while more pages remain. A stop that is
 * not among the loaded ones has no known position.
 * @param params.currentIndex - the open stop's index, -1 when it is not loaded
 * @param params.loadedCount - how many stops are loaded
 * @param params.totalCount - the server's total; null when it is not known
 * @param params.hasMoreItems - whether the server has stops past the loaded ones
 */
export function formatExamplePosition({
  currentIndex,
  loadedCount,
  totalCount,
  hasMoreItems,
}: {
  currentIndex: number;
  loadedCount: number;
  totalCount: number | null;
  hasMoreItems: boolean;
}): string {
  const positionText =
    currentIndex >= 0 ? String(currentIndex + 1) : UNKNOWN_POSITION_TEXT;
  const totalText =
    totalCount != null
      ? String(Math.max(totalCount, loadedCount))
      : `${loadedCount}${hasMoreItems ? "+" : ""}`;
  return `${positionText} / ${totalText}`;
}
