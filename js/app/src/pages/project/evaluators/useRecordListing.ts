import { useState, useTransition } from "react";

import type { RecordedRunRow } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";

/** Rows arrive in pages of this many; the first page fits the table without scrolling. */
export const RECORD_PAGE_SIZE = 10;

type RecordListing = {
  filterCondition: string;
  startIso: string;
  limit: number;
  /** The rows on screen when "Load more" was last pressed, in their order. */
  listedRows: RecordedRunRow[];
};

/**
 * How far a record source has paged under its filter and time window. Each
 * "Load more" re-reads the newest `limit` records, so records that arrived
 * since the last read come back above the rows already listed;
 * `appendLoadedRows` keeps those rows at the top and puts the rest of the
 * re-read below them. A new filter or window is a new listing, so it starts
 * again at the first page.
 */
export function useRecordListing({
  filterCondition,
  startIso,
}: {
  filterCondition: string;
  startIso: string;
}) {
  const [listing, setListing] = useState<RecordListing>({
    filterCondition,
    startIso,
    limit: RECORD_PAGE_SIZE,
    listedRows: [],
  });
  const [isShowingMore, startShowMoreTransition] = useTransition();
  const isCurrentListing =
    listing.filterCondition === filterCondition &&
    listing.startIso === startIso;
  if (!isCurrentListing) {
    // Forget the earlier listing, so going back to its filter or window
    // starts at the first page as well. This is React's "adjusting state when
    // a prop changes": set during render, and settled after one pass because
    // the new listing matches the props. An effect would commit one render
    // with the old listing first.
    setListing({
      filterCondition,
      startIso,
      limit: RECORD_PAGE_SIZE,
      listedRows: [],
    });
  }
  const limit = isCurrentListing ? listing.limit : RECORD_PAGE_SIZE;
  const listedRows = isCurrentListing ? listing.listedRows : [];
  return {
    limit,
    isShowingMore,
    /**
     * The listed rows first, each as the re-read returns it, or as last read
     * if more records arrived than the wider page has room for. Then the rest
     * of the re-read, in its order.
     */
    appendLoadedRows: (loadedRows: RecordedRunRow[]): RecordedRunRow[] => {
      const loadedRowByKey = new Map(loadedRows.map((row) => [row.key, row]));
      const listedRowKeys = new Set(listedRows.map(({ key }) => key));
      return [
        ...listedRows.map((row) => loadedRowByKey.get(row.key) ?? row),
        ...loadedRows.filter(({ key }) => !listedRowKeys.has(key)),
      ];
    },
    showMore: (rows: RecordedRunRow[]) =>
      startShowMoreTransition(() =>
        setListing({
          filterCondition,
          startIso,
          limit: limit + RECORD_PAGE_SIZE,
          listedRows: rows,
        })
      ),
  };
}
