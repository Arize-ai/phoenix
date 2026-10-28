import { isStringKeyedObject } from "@phoenix/typeUtils";

/** How long a value preview beside an input may be before it is cut. */
export const INPUT_PREVIEW_MAX_CHARS = 60;

/** A value shown beside an input in the drawn state, as a code comment. */
export type DecisionInputPreview =
  | {
      kind: "value";
      /** One line, cut to {@link INPUT_PREVIEW_MAX_CHARS}. */
      text: string;
      /** The whole value, for a tooltip. */
      full: string;
      /** Where the value comes from, e.g. "example 1"; omitted for typed values. */
      source?: string;
    }
  | { kind: "missing"; source: string };

/**
 * A value as one short line of JSON: strings quoted, line breaks and runs of
 * whitespace collapsed, cut with an ellipsis past `maxChars`.
 */
export function formatInputPreview(
  value: unknown,
  maxChars = INPUT_PREVIEW_MAX_CHARS
): { text: string; full: string } {
  const json = JSON.stringify(value) ?? String(value);
  const text = json
    .replace(/\\[nrt]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const full =
    typeof value === "string"
      ? value
      : (JSON.stringify(value, null, 2) ?? String(value));
  return {
    text:
      text.length > maxChars
        ? `${text.slice(0, maxChars - 1).trimEnd()}…`
        : text,
    full,
  };
}

/** A JSON object with named fields; an array's indexes are not input names. */
function isNamedFields(value: unknown): value is Record<string, unknown> {
  return isStringKeyedObject(value) && !Array.isArray(value);
}

/**
 * The input names a decision could read from these examples: each example's
 * top-level keys, deduplicated in the order they are first seen.
 */
export function getExampleInputNames(
  exampleVariables: readonly unknown[]
): string[] {
  const names = new Set<string>();
  for (const variables of exampleVariables) {
    if (!isNamedFields(variables)) continue;
    for (const name of Object.keys(variables)) names.add(name);
  }
  return [...names];
}

/**
 * The preview beside each input: over a dataset, the first example's value
 * (or that the example lacks it); otherwise the value typed in the Inputs
 * panel, read as it is sent (JSON objects and arrays structured). An empty
 * typed value has no preview.
 */
export function getDecisionInputPreviews({
  names,
  exampleVariables,
  variables,
  toSentValue,
}: {
  names: readonly string[];
  /** The scoped variables of the dataset's first examples; undefined without a dataset. */
  exampleVariables: readonly unknown[] | undefined;
  variables: Record<string, string | undefined> | undefined;
  toSentValue: (value: string) => unknown;
}): Record<string, DecisionInputPreview> {
  const previews: Record<string, DecisionInputPreview> = {};
  if (exampleVariables) {
    // Until the examples load there is nothing to show.
    if (exampleVariables.length === 0) return previews;
    const first = exampleVariables[0];
    const source = "example 1";
    for (const name of names) {
      previews[name] =
        isNamedFields(first) && Object.hasOwn(first, name)
          ? { kind: "value", source, ...formatInputPreview(first[name]) }
          : { kind: "missing", source };
    }
    return previews;
  }
  for (const name of names) {
    const value = variables?.[name];
    if (value == null || value === "") continue;
    previews[name] = {
      kind: "value",
      ...formatInputPreview(toSentValue(value)),
    };
  }
  return previews;
}
