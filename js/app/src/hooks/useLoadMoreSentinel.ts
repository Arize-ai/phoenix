import type { RefCallback } from "react";
import { useEffect, useEffectEvent, useState } from "react";

type LoadNextOptions = {
  onComplete?: (error: Error | null) => void;
};

/** Loads pages while the sentinel element remains in view. */
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
  loadNext: (count: number, options?: LoadNextOptions) => unknown;
  pageSize: number;
  /** A change re-checks whether the sentinel is still visible. */
  rows: ReadonlyArray<unknown>;
  margin?: string;
}): RefCallback<T> {
  const [sentinel, setSentinel] = useState<T | null>(null);
  // Avoid tight retries while a failed sentinel remains visible.
  const [isPaused, setIsPaused] = useState(false);
  const onIntersect = useEffectEvent((isIntersecting: boolean) => {
    if (!isIntersecting) {
      setIsPaused(false);
      return;
    }
    if (isPaused || !hasNext || isLoadingNext) {
      return;
    }
    loadNext(pageSize, {
      onComplete: (error) => {
        if (error) {
          setIsPaused(true);
        }
      },
    });
  });
  useEffect(() => {
    if (sentinel == null || !hasNext || isLoadingNext) {
      return undefined;
    }
    // Re-subscribe after each page so a visible sentinel can keep loading.
    const observer = new IntersectionObserver(
      (entries) => onIntersect(entries[entries.length - 1].isIntersecting),
      { rootMargin: margin, scrollMargin: margin }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasNext, isLoadingNext, rows, margin]);
  return setSentinel;
}
