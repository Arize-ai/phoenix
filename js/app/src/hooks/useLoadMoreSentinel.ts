import type { RefCallback } from "react";
import { useEffect, useEffectEvent, useState } from "react";

/**
 * Loads the next page of a paginated connection while a sentinel element is
 * in view, whether the table owns the scroll or sits in a scrolling page.
 *
 * Returns the ref to attach to the sentinel, typically an empty element after
 * the last row.
 */
export function useLoadMoreSentinel<T extends Element>({
  hasNext,
  isLoadingNext,
  loadNext,
  pageSize,
  rows,
  margin = "300px",
}: {
  hasNext: boolean;
  isLoadingNext: boolean;
  loadNext: (count: number) => void;
  pageSize: number;
  /**
   * The loaded rows. A change re-checks whether the sentinel is still in view,
   * which also covers a load the pagination silently skipped (for example
   * while the parent query was still in flight).
   */
  rows: ReadonlyArray<unknown>;
  /** How far ahead of the sentinel to start loading. */
  margin?: string;
}): RefCallback<T> {
  const [sentinel, setSentinel] = useState<T | null>(null);
  const onIntersect = useEffectEvent((isIntersecting: boolean) => {
    if (isIntersecting && hasNext && !isLoadingNext) {
      loadNext(pageSize);
    }
  });
  useEffect(() => {
    if (sentinel == null || !hasNext || isLoadingNext) {
      return undefined;
    }
    // A new observer reports the current intersection once, so subscribing
    // again after each page settles keeps loading while the sentinel is still
    // in view and never acts on a rectangle measured before the rows committed.
    const observer = new IntersectionObserver(
      (entries) => onIntersect(entries[entries.length - 1].isIntersecting),
      { rootMargin: margin, scrollMargin: margin }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasNext, isLoadingNext, rows, margin]);
  return setSentinel;
}
