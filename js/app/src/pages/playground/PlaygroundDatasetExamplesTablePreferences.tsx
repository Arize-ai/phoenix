import { createTablePreferencesContext } from "@phoenix/contexts/createTablePreferencesContext";

/**
 * Column preferences for the playground's dataset examples table, persisted
 * per browser like the other tables' column choices. Provided around the
 * Experiment panel so the toolbar's column selector and the table share them.
 */
export const {
  Provider: PlaygroundDatasetExamplesTablePreferencesProvider,
  useTablePreferences: usePlaygroundDatasetExamplesTablePreferences,
} = createTablePreferencesContext({
  name: "playgroundDatasetExamplesTablePreferencesStore",
  storageKey: "arize-phoenix-playground-dataset-examples-table",
});
