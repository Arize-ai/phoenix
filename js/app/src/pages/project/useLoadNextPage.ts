import { useCallback } from "react";

type LoadNextOptions = { onComplete?: (error: Error | null) => void };

/**
 * The spans and traces tables' next-page loader, which also reports the
 * page's outcome to the table's deferred-parts failure.
 *
 * @param params - the table's pagination and failure hooks
 * @param params.loadNext - the table's `usePaginationFragment` loader
 * @param params.onLoadMoreComplete - from `useDeferredPartsFailure`
 */
export function useLoadNextPage({
  loadNext,
  onLoadMoreComplete,
}: {
  loadNext: (
    count: number,
    options: { onComplete: (error: Error | null) => void }
  ) => unknown;
  onLoadMoreComplete: (error: Error | null) => void;
}) {
  return useCallback(
    (count: number, options?: LoadNextOptions) =>
      loadNext(count, {
        onComplete: (error) => {
          onLoadMoreComplete(error);
          options?.onComplete?.(error);
        },
      }),
    [loadNext, onLoadMoreComplete]
  );
}
