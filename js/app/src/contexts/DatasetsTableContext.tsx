import { DATASETS_TABLE_STORAGE_KEY } from "@phoenix/constants/storageConstants";
import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

export const {
  Provider: DatasetsTableProvider,
  useTablePreferences: useDatasetsTableContext,
} = createTablePreferencesContext({
  name: "datasetsTableStore",
  storageKey: DATASETS_TABLE_STORAGE_KEY,
});
