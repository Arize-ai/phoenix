import { useState, useTransition } from "react";

import type { RecordedRunRow } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";

/** The first page fits the record table without scrolling. */
export const NUM_RECORDS_PER_PAGE = 10;

type LoadMoreState = {
  /** Trimmed, as the record query sends it. */
  filterCondition: string;
  timeWindowStartISOTimestamp: string;
  numRecordsToLoad: number;
  /** The rows on screen when "Load more" was last pressed, in their order. */
  listedRows: RecordedRunRow[];
};

/**
 * "Load more" for a record table of the evaluator test bench. Each press
 * re-reads the newest `numRecordsToLoad` records under the filter and time
 * window, so records that arrived since the last read come back above the rows
 * already on screen; `keepListedRowsFirst` keeps those rows at the top and
 * puts the rest of the re-read below them. A new filter or time window starts
 * again at the first page.
 *
 * @param params - what the record query reads under
 * @param params.filterCondition - the scope's filter condition, as the form holds it
 * @param params.timeWindowStartISOTimestamp - the ISO 8601 timestamp the time window starts at
 */
export function useLoadMoreRecords({
  filterCondition,
  timeWindowStartISOTimestamp,
}: {
  filterCondition: string;
  timeWindowStartISOTimestamp: string;
}) {
  // The record query trims the filter, so whitespace typed around it reads
  // the same records and must not start again at the first page.
  const trimmedFilterCondition = filterCondition.trim();
  const firstPageState: LoadMoreState = {
    filterCondition: trimmedFilterCondition,
    timeWindowStartISOTimestamp,
    numRecordsToLoad: NUM_RECORDS_PER_PAGE,
    listedRows: [],
  };
  const [storedState, setStoredState] = useState(firstPageState);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const isStoredStateCurrent =
    storedState.filterCondition === trimmedFilterCondition &&
    storedState.timeWindowStartISOTimestamp === timeWindowStartISOTimestamp;
  if (!isStoredStateCurrent) {
    // Set during render ("adjusting state when a prop changes") because an
    // effect would commit one render with the earlier filter's rows first.
    setStoredState(firstPageState);
  }
  const { numRecordsToLoad, listedRows } = isStoredStateCurrent
    ? storedState
    : firstPageState;
  return {
    /** How many of the newest records the record query reads. */
    numRecordsToLoad,
    isLoadingMore,
    /**
     * Orders a re-read for the table: the listed rows first, each as the
     * re-read returns it, then the rest of the re-read, in its order. A listed
     * row the re-read lacks stays as last read while the re-read has a next
     * page: more records arrived than the wider page has room for. A re-read
     * with no next page holds every record in scope, so a listed row it lacks
     * is gone and is dropped.
     *
     * @param params - the re-read
     * @param params.loadedRows - the rows the re-read returned, newest first
     * @param params.hasNextPage - whether the re-read has a next page
     */
    keepListedRowsFirst: ({
      loadedRows,
      hasNextPage,
    }: {
      loadedRows: RecordedRunRow[];
      hasNextPage: boolean;
    }): RecordedRunRow[] => {
      // A key can repeat (an in-progress trace with two root spans), so each
      // listed row takes one loaded row of its key, not every row of the key.
      const unlistedRows = [...loadedRows];
      const keptRows = listedRows.flatMap((listedRow) => {
        const loadedRowIndex = unlistedRows.findIndex(
          ({ key }) => key === listedRow.key
        );
        if (loadedRowIndex !== -1) {
          return unlistedRows.splice(loadedRowIndex, 1);
        }
        return hasNextPage ? [listedRow] : [];
      });
      return [...keptRows, ...unlistedRows];
    },
    /**
     * Reads one more page of records.
     *
     * @param params - the table as it is now
     * @param params.listedRows - the rows on screen, in their order
     */
    loadMore: ({ listedRows }: { listedRows: RecordedRunRow[] }) =>
      startLoadMoreTransition(() =>
        setStoredState({
          ...firstPageState,
          numRecordsToLoad: numRecordsToLoad + NUM_RECORDS_PER_PAGE,
          listedRows,
        })
      ),
  };
}
