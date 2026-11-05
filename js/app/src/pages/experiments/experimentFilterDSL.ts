import type { Completion } from "@codemirror/autocomplete";
import { snippetCompletion } from "@codemirror/autocomplete";

import type { DSLFilterSnippet } from "@phoenix/components/filter";
import { getDslStringLiteral } from "@phoenix/utils/filterConditionUtils";

/**
 * The experiment filter vocabulary, matching `EXPERIMENT_FILTER_DESCRIPTIONS`
 * on the server.
 */
export const experimentFilterCompletions: Completion[] = [
  {
    label: "name",
    type: "variable",
    detail: "string",
    info: "The experiment's name. `in` ignores case; `==` is exact.",
  },
  {
    label: "description",
    type: "variable",
    detail: "string",
    info: "The experiment's description. `in` ignores case; `==` is exact.",
  },
  {
    label: "project_name",
    type: "variable",
    detail: "string",
    info: "The name of the project that holds the experiment's traces.",
  },
  {
    label: "repetitions",
    type: "variable",
    detail: "number",
    info: "How many times the experiment runs each example.",
  },
  {
    label: "created_at",
    type: "variable",
    detail: "datetime",
    info: "When the experiment was created, as an ISO 8601 string such as 2026-07-01T00:00:00Z.",
  },
  {
    label: "updated_at",
    type: "variable",
    detail: "datetime",
    info: "When the experiment was last updated, as an ISO 8601 string such as 2026-07-01T00:00:00Z.",
  },
  snippetCompletion('metadata["${key}"]', {
    label: 'metadata["key"]',
    type: "variable",
    detail: "json",
    info: 'A value in the experiment\'s metadata. Each subscript is one key, so metadata["a"]["b"] reads b nested under a.',
  }),
];

export const experimentFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "match a metadata value",
    snippet: 'metadata["${key}"] == "${value}"',
    boost: 1,
  },
  {
    label: "search names for text",
    snippet: '"${text}" in name',
  },
  {
    label: "created after a date",
    snippet: 'created_at > "${2026-01-01T00:00:00Z}"',
  },
];

export type ExperimentMetadataFilterValue = string | number | boolean;

/**
 * A metadata match entered in the Metadata form, which the table turns into
 * an experiment filter condition.
 */
export type ExperimentMetadataFilter = {
  /**
   * The keys to follow from the top of the metadata object, outermost first.
   */
  path: string[];
  value: ExperimentMetadataFilterValue;
};

/**
 * Splits a dot-separated key such as `model_params.temperature` into a key
 * path. Returns null when the key is blank or has an empty segment.
 */
export function parseMetadataFilterKey(key: string): string[] | null {
  const path = key.split(".").map((segment) => segment.trim());
  return path.includes("") ? null : path;
}

/**
 * Whether a number can be written into a condition unchanged: finite and,
 * when whole, within the range JavaScript represents exactly.
 */
function isSupportedNumber(value: number): boolean {
  return (
    Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
  );
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
    // `1e999` parses to `Infinity`, which JSON can't send, and a whole number
    // past the safe range loses precision, so both stay text.
    if (
      typeof parsed === "string" ||
      typeof parsed === "boolean" ||
      (typeof parsed === "number" && isSupportedNumber(parsed))
    ) {
      return parsed;
    }
  } catch {
    // Not JSON, so the text is a bare string.
  }
  return trimmed;
}

function getDslValueLiteral(value: ExperimentMetadataFilterValue): string {
  if (typeof value === "string") {
    return getDslStringLiteral({ value, quote: '"' });
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}

/**
 * Writes a metadata match as an experiment filter condition, for example
 * `metadata["model"]["name"] == "gpt-5"`.
 */
export function getMetadataFilterCondition({
  path,
  value,
}: ExperimentMetadataFilter): string {
  const subscripts = path
    .map((key) => `[${getDslStringLiteral({ value: key, quote: '"' })}]`)
    .join("");
  return `metadata${subscripts} == ${getDslValueLiteral(value)}`;
}
