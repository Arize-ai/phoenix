/**
 * Base local-storage keys and key prefixes used across the app.
 *
 * Every piece of UI state Phoenix persists to `localStorage` is keyed from
 * here so the browser-storage inventory (see
 * `@phoenix/utils/localStorageUsageUtils`) can account for, and clear, each
 * of them. Add new keys here rather than inlining literals at the call site.
 *
 * Keys marked "scoped" are resolved through `scopeStorageKeyToBasename` at
 * read/write time so co-hosted workspaces don't share them.
 */

// Preferences
export const PREFERENCES_STORAGE_KEY = "arize-phoenix-preferences";
export const THEME_STORAGE_KEY = "arize-phoenix-theme";
export const FEATURE_FLAGS_STORAGE_KEY = "arize-phoenix-feature-flags";

// Layout
/** Prefix react-resizable-panels writes `useDefaultLayout` layouts under. */
export const PANEL_LAYOUT_STORAGE_KEY_PREFIX = "react-resizable-panels:";
export const DRAWER_SIZE_STORAGE_KEY_PREFIX = "arize-phoenix-drawer-";

// Tables and views
export const PROMPTS_TABLE_STORAGE_KEY = "arize-phoenix-prompts-table";
export const DATASETS_TABLE_STORAGE_KEY = "arize-phoenix-datasets-table";
export const PROJECT_STORAGE_KEY_PREFIX = "arize-phoenix-project-";
export const TRACING_TABLE_STORAGE_KEY_PREFIX = "arize-phoenix-tracing-";
export const DATASET_STORAGE_KEY_PREFIX = "arize-phoenix-dataset-";
/**
 * Prefix for the experiments table's persisted column state. It predates the
 * `arize-phoenix-` convention and is kept as is so existing preferences
 * survive; the inventory recognizes it explicitly.
 */
export const EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX =
  "phoenix-experiments-column-";
export const EXPERIMENT_COMPARE_CHARTS_STORAGE_KEY =
  "arize-phoenix-experiment-compare-charts";

// Playground
export const PLAYGROUND_STORAGE_KEY = "arize-phoenix-playground";
export const CREDENTIALS_STORAGE_KEY = "arize-phoenix-credentials";

// Assistant (scoped)
export const ASSISTANT_STORAGE_BASE_KEY = "arize-phoenix-assistant";
export const AGENT_MODEL_CONFIG_STORAGE_BASE_KEY =
  "__experimental__arize-phoenix-agent-config";

// Chat (scoped)
export const CHAT_MODEL_STORAGE_BASE_KEY = "arize-phoenix-chat-model";
export const CHAT_PARAMETERS_STORAGE_BASE_KEY = "arize-phoenix-chat-parameters";

// History
export const FILTER_HISTORY_STORAGE_KEY_PREFIX =
  "arize-phoenix-filter-history-";
export const RECENTLY_VIEWED_STORAGE_KEY = "arize-phoenix-recently-viewed";

// Notices
export const DISMISSED_UPDATE_VERSION_STORAGE_KEY =
  "arize-phoenix-dismissed-update-version";
