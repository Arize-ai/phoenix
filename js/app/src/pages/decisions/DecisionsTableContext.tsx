import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

export const {
  Provider: DecisionsTableProvider,
  useTablePreferences: useDecisionsTableContext,
} = createTablePreferencesContext({
  name: "decisionsTableStore",
  storageKey: "phoenix-decisions-table",
});
