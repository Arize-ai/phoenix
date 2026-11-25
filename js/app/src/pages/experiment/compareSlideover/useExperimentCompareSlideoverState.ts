import { useCallback, useLayoutEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { ExperimentCompareSlideoverState } from "./experimentCompareSlideoverSearchParams";
import {
  applyExperimentCompareSlideoverState,
  parseExperimentCompareSlideoverState,
} from "./experimentCompareSlideoverSearchParams";

/**
 * The experiment compare slideover's view state, read from and written to
 * the URL so a copied link reopens the same example, lanes and mode.
 *
 * The returned functions keep their identity across URL changes. The compare
 * tables build their memoized columns from them, and a column whose renderer
 * changes identity remounts every cell under it.
 */
export function useExperimentCompareSlideoverState() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = parseExperimentCompareSlideoverState(searchParams);

  const latestSearchParamsRef = useRef(searchParams);
  useLayoutEffect(() => {
    latestSearchParamsRef.current = searchParams;
  }, [searchParams]);

  const updateState = useCallback(
    ({
      changes,
      replace = true,
    }: {
      changes: Partial<ExperimentCompareSlideoverState>;
      /** Whether the change replaces the current history entry */
      replace?: boolean;
    }) => {
      const nextSearchParams = applyExperimentCompareSlideoverState({
        searchParams: latestSearchParamsRef.current,
        changes,
      });
      // Several changes can land before the next render
      latestSearchParamsRef.current = nextSearchParams;
      navigate({ search: `?${nextSearchParams.toString()}` }, { replace });
    },
    [navigate]
  );

  /**
   * Opens an example, or swaps to it when the slideover is already open. The
   * first open adds a history entry so Back closes the slideover.
   */
  const openExample = useCallback(
    ({
      exampleId,
      baseRepetitionNumber,
    }: {
      exampleId: string;
      /** The base repetition to show, when the caller's row is a single run */
      baseRepetitionNumber?: number;
    }) => {
      const isOpen =
        parseExperimentCompareSlideoverState(latestSearchParamsRef.current)
          .selectedExampleId != null;
      updateState({
        changes: { selectedExampleId: exampleId, baseRepetitionNumber },
        replace: isOpen,
      });
    },
    [updateState]
  );

  const closeSlideover = useCallback(() => {
    updateState({
      changes: {
        selectedExampleId: null,
        baseRepetitionNumber: 1,
        compareRepetitionNumber: 1,
      },
    });
  }, [updateState]);

  return { state, updateState, openExample, closeSlideover };
}
