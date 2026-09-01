import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

export const {
  Provider: ProjectEvaluatorsTableProvider,
  useTablePreferences: useProjectEvaluatorsTableContext,
} = createTablePreferencesContext({
  name: "projectEvaluatorsTableStore",
  storageKey: "arize-phoenix-project-evaluators-table",
});
