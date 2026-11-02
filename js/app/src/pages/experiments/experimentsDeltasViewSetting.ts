import type { TableViewSetting } from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

/**
 * The experiments table's view setting that shows or hides the deltas against
 * the baseline experiment. Shown until the user turns them off; the
 * visibility is persisted per dataset.
 */
export function useExperimentsDeltasViewSetting(): TableViewSetting {
  const isEnabled = useDatasetContext(
    (state) => state.areExperimentsDeltasVisible
  );
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
