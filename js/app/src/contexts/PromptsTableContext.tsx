import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

export const {
  Provider: PromptsTableProvider,
  useTablePreferences: usePromptsTableContext,
} = createTablePreferencesContext({
  name: "promptsTableStore",
  storageKey: "arize-phoenix-prompts-table",
});
