import type { TableViewSetting } from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

/**
 * Whether the experiments table shows each experiment's deltas against the
 * dataset's baseline experiment. Shown until the user turns them off.
 */
export function useAreExperimentsDeltasVisible(): boolean {
  return useDatasetContext((state) => state.areExperimentsDeltasVisible);
}

/**
 * The experiments table's view setting that shows or hides the deltas against
 * the baseline experiment. The visibility is persisted per dataset.
 */
export function useExperimentsDeltasViewSetting(): TableViewSetting {
  const isEnabled = useAreExperimentsDeltasVisible();
  const setIsEnabled = useDatasetContext(
    (state) => state.setAreExperimentsDeltasVisible
  );
  return {
    id: "deltas",
    label: "Show deltas vs. baseline",
    isEnabled,
    onChange: setIsEnabled,
  };
}
