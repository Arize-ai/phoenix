import { EXAMPLES_TABLE_STORAGE_KEY } from "@phoenix/constants/storageConstants";
import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

/** Column preferences for the dataset examples table, shared by all datasets. */
export const {
  Provider: ExamplesTableProvider,
  useTablePreferences: useExamplesTableContext,
} = createTablePreferencesContext({
  name: "examplesTableStore",
  storageKey: EXAMPLES_TABLE_STORAGE_KEY,
});
