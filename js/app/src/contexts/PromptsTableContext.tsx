import { PROMPTS_TABLE_STORAGE_KEY } from "@phoenix/constants/storageConstants";
import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

export const {
  Provider: PromptsTableProvider,
  useTablePreferences: usePromptsTableContext,
} = createTablePreferencesContext({
  name: "promptsTableStore",
  storageKey: PROMPTS_TABLE_STORAGE_KEY,
});
