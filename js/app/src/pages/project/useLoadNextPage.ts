import { useCallback } from "react";

type LoadNextOptions = { onComplete?: (error: Error | null) => void };

/**
 * The spans and traces tables' next-page loader. It reports its outcome to
 * the table's deferred payload status as the page that starts at the
 * table's current row count.
 *
 * @param params - the table's pagination and failure hooks
 * @param params.loadNext - the table's `usePaginationFragment` loader
 * @param params.rowCount - the rows the table has, where the next page starts
 * @param params.trackNextPage - from `useDeferredPayloadStatus`
 */
export function useLoadNextPage({
  loadNext,
  rowCount,
  trackNextPage,
}: {
  loadNext: (
    count: number,
    options: { onComplete: (error: Error | null) => void }
  ) => unknown;
  rowCount: number;
  trackNextPage: (firstRow: number) => (error: Error | null) => void;
}) {
  return useCallback(
    (count: number, options?: LoadNextOptions) => {
      const onPageComplete = trackNextPage(rowCount);
      return loadNext(count, {
        onComplete: (error) => {
          onPageComplete(error);
          options?.onComplete?.(error);
        },
      });
    },
    [loadNext, rowCount, trackNextPage]
  );
}
