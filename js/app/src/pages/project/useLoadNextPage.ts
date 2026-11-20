import { useCallback } from "react";

type LoadNextOptions = { onComplete?: (error: Error | null) => void };

/**
 * The spans and traces tables' next-page loader. A next page leaves out the
 * project's annotation names, which the table already has, and reports its
 * outcome to the table's deferred-parts failure as the page that starts at
 * the table's current row count.
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
    options: {
      onComplete: (error: Error | null) => void;
      UNSTABLE_extraVariables: { includeAnnotationNames: boolean };
    }
  ) => unknown;
  rowCount: number;
  trackNextPage: (firstRow: number) => (error: Error | null) => void;
}) {
  return useCallback(
    (count: number, options?: LoadNextOptions) => {
      const onPageComplete = trackNextPage(rowCount);
      return loadNext(count, {
        UNSTABLE_extraVariables: { includeAnnotationNames: false },
        onComplete: (error) => {
          onPageComplete(error);
          options?.onComplete?.(error);
        },
      });
    },
    [loadNext, rowCount, trackNextPage]
  );
}
