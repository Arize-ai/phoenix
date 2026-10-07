import type { TableViewSetting } from "@phoenix/components/table";
import { useExperimentCompareChartsStore } from "@phoenix/store/experimentCompareChartsStore";

/**
 * Whether the dataset's compare grid shows each compare experiment's deltas
 * against the base. Shown until the user turns them off.
 */
export function useAreExperimentCompareDeltasVisible(
  datasetId: string
): boolean {
  return useExperimentCompareChartsStore(
    (state) => state.areDeltasVisibleByDatasetId[datasetId] ?? true
  );
}

/**
 * The compare grid's view setting that shows or hides the deltas against the
 * base. The visibility is persisted per dataset.
 */
export function useExperimentCompareDeltasViewSetting(
  datasetId: string
): TableViewSetting {
  const isEnabled = useAreExperimentCompareDeltasVisible(datasetId);
  const setAreDeltasVisible = useExperimentCompareChartsStore(
    (state) => state.setAreDeltasVisible
  );
  return {
    id: "deltas",
    label: "Show deltas vs. base",
    isEnabled,
    onChange: (isVisible: boolean) =>
      setAreDeltasVisible({ datasetId, isVisible }),
  };
}
