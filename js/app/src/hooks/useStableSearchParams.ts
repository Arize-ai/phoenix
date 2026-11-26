import { useCallback, useLayoutEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";

export type SearchParamsUpdater = (params: {
  /** Returns the next search params from a copy of the current ones */
  update: (searchParams: URLSearchParams) => URLSearchParams;
  /**
   * Decides, from the search params being replaced, whether the change
   * replaces the current history entry. Without it the entry is replaced.
   */
  replace?: (searchParams: URLSearchParams) => boolean;
}) => void;

/**
 * The current search params with an updater whose identity never changes.
 *
 * `setSearchParams` from react-router is re-created on every search change,
 * so a callback built on it invalidates whatever memoizes on that callback
 * each time the URL moves. Tables that build memoized columns from such
 * callbacks would remount every cell. The updater also skips the navigation
 * when the update leaves the search unchanged.
 */
export function useStableSearchParams(): [
  URLSearchParams,
  SearchParamsUpdater,
] {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const latestSearchParamsRef = useRef(searchParams);
  useLayoutEffect(() => {
    latestSearchParamsRef.current = searchParams;
  }, [searchParams]);

  const updateSearchParams: SearchParamsUpdater = useCallback(
    ({ update, replace }) => {
      const currentSearchParams = latestSearchParamsRef.current;
      const nextSearchParams = update(new URLSearchParams(currentSearchParams));
      if (nextSearchParams.toString() === currentSearchParams.toString()) {
        return;
      }
      // Several updates can land before the next render
      latestSearchParamsRef.current = nextSearchParams;
      navigate(
        { search: nextSearchParams.toString() },
        { replace: replace?.(currentSearchParams) ?? true }
      );
    },
    [navigate]
  );

  return [searchParams, updateSearchParams];
}
