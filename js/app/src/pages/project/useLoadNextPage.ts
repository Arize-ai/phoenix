import { useCallback } from "react";

type LoadNextOptions = { onComplete?: (error: Error | null) => void };

/**
 * Relay's `loadNext` for the spans and traces tables: skips annotation names,
 * and marks the new rows failed if the page's request fails.
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
