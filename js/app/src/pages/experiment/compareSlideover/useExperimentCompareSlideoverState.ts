import { useCallback } from "react";

import { useStableSearchParamsUpdater } from "@phoenix/hooks";

import type { ExperimentCompareNavigationItem } from "./experimentCompareExampleNavigation";
import type { ExperimentCompareSlideoverState } from "./experimentCompareSlideoverSearchParams";
import {
  applyExperimentCompareSlideoverState,
  parseExperimentCompareSlideoverState,
} from "./experimentCompareSlideoverSearchParams";

/**
 * The experiment compare slideover's view state, read from and written to
 * the URL so a copied link reopens the same example, lanes and mode. The
 * returned functions keep their identity across URL changes, since the
 * compare tables build their memoized columns from them.
 */
export function useExperimentCompareSlideoverState() {
  const [searchParams, updateSearchParams] = useStableSearchParamsUpdater();
  const state = parseExperimentCompareSlideoverState(searchParams);

  const updateState = useCallback(
    ({
      changes,
      replace,
    }: {
      changes: Partial<ExperimentCompareSlideoverState>;
      /** Whether the change replaces the current history entry (default true) */
      replace?: boolean;
    }) => {
      updateSearchParams({
        update: (currentSearchParams) =>
          applyExperimentCompareSlideoverState({
            searchParams: currentSearchParams,
            changes,
          }),
        replace,
      });
    },
    [updateSearchParams]
  );

  /**
   * Opens a stop, or swaps to it when the slideover is already open. The
   * first open adds a history entry so Back closes the slideover.
   */
  const openExample = useCallback(
    ({ exampleId, baseRepetitionNumber }: ExperimentCompareNavigationItem) => {
      updateSearchParams({
        update: (currentSearchParams) =>
          applyExperimentCompareSlideoverState({
            searchParams: currentSearchParams,
            changes: { selectedExampleId: exampleId, baseRepetitionNumber },
          }),
        replace: (currentSearchParams) =>
          parseExperimentCompareSlideoverState(currentSearchParams)
            .selectedExampleId != null,
      });
    },
    [updateSearchParams]
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
