const JSON_VIEW_MODES = ["json", "table"] as const;

/**
 * How a JSON value is rendered — as a JSON document or as a table of its
 * flattened keys.
 */
export type JSONViewMode = (typeof JSON_VIEW_MODES)[number];

/**
 * TypeGuard for the JSON view mode
 */
export function isJSONViewMode(value: unknown): value is JSONViewMode {
  return JSON_VIEW_MODES.some((mode) => mode === value);
}
