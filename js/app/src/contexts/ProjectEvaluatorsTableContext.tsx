import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

/**
 * The local storage key the evaluators table preferences persist to. Exported
 * for the route loader, which reads the persisted column visibility before
 * React mounts to decide whether to fetch the mean score column's data.
 */
export const PROJECT_EVALUATORS_TABLE_STORAGE_KEY =
  "arize-phoenix-project-evaluators-table";

export const {
  Provider: ProjectEvaluatorsTableProvider,
  useTablePreferences: useProjectEvaluatorsTableContext,
} = createTablePreferencesContext({
  name: "projectEvaluatorsTableStore",
  storageKey: PROJECT_EVALUATORS_TABLE_STORAGE_KEY,
});
