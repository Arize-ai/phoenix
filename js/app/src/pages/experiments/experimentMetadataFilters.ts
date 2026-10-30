/**
 * Parsing and URL encoding for the experiments table's metadata filters.
 * Each filter matches experiments whose metadata holds a value at a key path.
 */

export type ExperimentMetadataFilterValue = string | number | boolean;

export type ExperimentMetadataFilter = {
  /**
   * The keys to follow from the top of the metadata object, outermost first.
   */
  path: string[];
  value: ExperimentMetadataFilterValue;
};

/**
 * The search param that holds the metadata filters as a JSON array.
 */
export const METADATA_FILTERS_SEARCH_PARAM = "metadataFilters";

/**
 * Splits a dot-separated key such as `model_params.temperature` into a key
 * path. Returns null when the key is blank or has an empty segment.
 */
export function parseMetadataFilterKey(key: string): string[] | null {
  const path = key.split(".").map((segment) => segment.trim());
  return path.includes("") ? null : path;
}

/**
 * Reads a typed value the way JSON does: `0.7` is a number, `true` is a
 * boolean, and `"0.7"` is a string. Any other text is taken as a string, so
 * `gpt-5` needs no quotes. Returns null for blank text.
 */
export function parseMetadataFilterValue(
  text: string
): ExperimentMetadataFilterValue | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    // `1e999` parses to `Infinity`, which JSON can't send, so it stays text.
    if (
      typeof parsed === "string" ||
      typeof parsed === "boolean" ||
      (typeof parsed === "number" && Number.isFinite(parsed))
    ) {
      return parsed;
    }
  } catch {
    // Not JSON, so the text is a bare string.
  }
  return trimmed;
}

/**
 * Formats a filter for display, for example `model == "gpt-5"`.
 */
export function formatMetadataFilter(filter: ExperimentMetadataFilter): string {
  return `${filter.path.join(".")} == ${JSON.stringify(filter.value)}`;
}

function isMetadataFilter(value: unknown): value is ExperimentMetadataFilter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { path, value: filterValue } = value as Record<string, unknown>;
  return (
    Array.isArray(path) &&
    path.length > 0 &&
    path.every((segment) => typeof segment === "string") &&
    ["string", "number", "boolean"].includes(typeof filterValue)
  );
}

/**
 * Reads the metadata filters from URL search params, dropping any that are
 * malformed.
 */
export function readMetadataFiltersFromSearchParams(
  searchParams: URLSearchParams
): ExperimentMetadataFilter[] {
  const raw = searchParams.get(METADATA_FILTERS_SEARCH_PARAM);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMetadataFilter) : [];
  } catch {
    return [];
  }
}

/**
 * Returns a copy of the search params with the metadata filters set, or
 * removed when there are none.
 */
export function writeMetadataFiltersToSearchParams(
  searchParams: URLSearchParams,
  filters: ExperimentMetadataFilter[]
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (filters.length) {
    next.set(METADATA_FILTERS_SEARCH_PARAM, JSON.stringify(filters));
  } else {
    next.delete(METADATA_FILTERS_SEARCH_PARAM);
  }
  return next;
}
