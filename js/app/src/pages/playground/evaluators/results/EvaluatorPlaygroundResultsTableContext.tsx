import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

/**
 * Column preferences for the evaluator playground's results table, persisted
 * per browser like the other tables' column choices.
 */
export const {
  Provider: EvaluatorPlaygroundResultsTableProvider,
  useTablePreferences: useEvaluatorPlaygroundResultsTablePreferences,
} = createTablePreferencesContext({
  name: "evaluatorPlaygroundResultsTableStore",
  storageKey: "arize-phoenix-evaluator-playground-results-table",
});
