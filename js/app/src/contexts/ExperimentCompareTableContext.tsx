import {
  EXPERIMENT_COMPARE_GRID_TABLE_STORAGE_KEY,
  EXPERIMENT_COMPARE_LIST_TABLE_STORAGE_KEY,
} from "@phoenix/constants/storageConstants";
import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

/** Column preferences for the experiment compare list view, shared by all comparisons. */
export const {
  Provider: ExperimentCompareListTableProvider,
  useTablePreferences: useExperimentCompareListTableContext,
} = createTablePreferencesContext({
  name: "experimentCompareListTableStore",
  storageKey: EXPERIMENT_COMPARE_LIST_TABLE_STORAGE_KEY,
});

/** Column preferences for the experiment compare grid view, shared by all comparisons. */
export const {
  Provider: ExperimentCompareGridTableProvider,
  useTablePreferences: useExperimentCompareGridTableContext,
} = createTablePreferencesContext({
  name: "experimentCompareGridTableStore",
  storageKey: EXPERIMENT_COMPARE_GRID_TABLE_STORAGE_KEY,
});
