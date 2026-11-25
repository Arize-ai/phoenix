import { useCallback, useLayoutEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";

export type SearchParamsUpdater = (params: {
  /** Returns the next search params from a copy of the current ones */
  update: (searchParams: URLSearchParams) => URLSearchParams;
  /**
   * Whether the change replaces the current history entry (default true).
   * A function decides from the search params being replaced.
   */
  replace?: boolean | ((searchParams: URLSearchParams) => boolean);
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
    ({ update, replace = true }) => {
      const currentSearchParams = latestSearchParamsRef.current;
      const nextSearchParams = update(new URLSearchParams(currentSearchParams));
      if (nextSearchParams.toString() === currentSearchParams.toString()) {
        return;
      }
      // Several updates can land before the next render
      latestSearchParamsRef.current = nextSearchParams;
      navigate(
        { search: nextSearchParams.toString() },
        {
          replace:
            typeof replace === "function"
              ? replace(currentSearchParams)
              : replace,
        }
      );
    },
    [navigate]
  );

  return [searchParams, updateSearchParams];
}
