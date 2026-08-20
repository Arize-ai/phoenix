import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

export const {
  Provider: DatasetsTableProvider,
  useTablePreferences: useDatasetsTableContext,
} = createTablePreferencesContext({
  name: "datasetsTableStore",
  storageKey: "arize-phoenix-datasets-table",
});
