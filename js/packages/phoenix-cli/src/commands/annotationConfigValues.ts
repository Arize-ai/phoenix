import type { componentsV1 } from "@arizeai/phoenix-client";

import { InvalidArgumentError } from "../exitCodes";

type CategoricalAnnotationValue =
  componentsV1["schemas"]["CategoricalAnnotationValue"];

/**
 * Options carrying the two supported ways to specify categorical values.
 *
 * `value` is the repeatable, shell-friendly form (`--value good=1`); `values`
 * is the JSON escape hatch (`--values '[{"label":"good","score":1}]'`) for
 * bulk or agent-driven use. The two are mutually exclusive.
 *
 * All parse failures throw `InvalidArgumentError` so handlers exit with
 * `ExitCode.INVALID_ARGUMENT` rather than the generic failure code.
 */
export interface CategoricalValueOptions {
  /** Collected occurrences of the repeatable `--value label[=score]` flag. */
  value?: string[];
  /** The `--values <json>` payload. */
  values?: string;
}

/**
 * Parse a single `--value label[=score]` token.
 *
 * The label is everything before the first `=`; the optional score is
 * everything after it. Splitting on the first `=` keeps labels that contain
 * later `=` characters intact. A label with no `=` has no score.
 */
function parseValueFlag(entry: string): CategoricalAnnotationValue {
  const separatorIndex = entry.indexOf("=");
  if (separatorIndex === -1) {
    if (entry.length === 0) {
      throw new InvalidArgumentError("--value requires a non-empty label");
    }
    return { label: entry };
  }
  const label = entry.slice(0, separatorIndex);
  const scoreText = entry.slice(separatorIndex + 1);
  if (label.length === 0) {
    throw new InvalidArgumentError(
      `--value '${entry}' is missing a label before '='`
    );
  }
  if (scoreText.trim().length === 0) {
    throw new InvalidArgumentError(
      `--value '${entry}' has an empty score; use 'label' for no score or 'label=<number>'`
    );
  }
  const score = Number(scoreText);
  if (!Number.isFinite(score)) {
    throw new InvalidArgumentError(
      `--value '${entry}' has a non-numeric score; expected 'label=<number>'`
    );
  }
  return { label, score };
}

/**
 * Parse the `--values` JSON payload into categorical annotation values.
 *
 * Accepts a JSON array of objects shaped like `{ "label": string, "score"?:
 * number }`. Throws a descriptive error on malformed input.
 */
function parseValuesJson(raw: string): CategoricalAnnotationValue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidArgumentError(
      "--values must be a valid JSON array, e.g. " +
        '\'[{"label":"good","score":1},{"label":"bad","score":0}]\''
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new InvalidArgumentError(
      "--values must be a non-empty JSON array of label objects"
    );
  }
  return parsed.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("label" in entry) ||
      typeof entry.label !== "string" ||
      entry.label.length === 0
    ) {
      throw new InvalidArgumentError(
        'Each --values entry must be an object with a non-empty string "label"'
      );
    }
    const label = entry.label;
    const score: unknown = "score" in entry ? entry.score : undefined;
    if (score !== undefined && score !== null && typeof score !== "number") {
      throw new InvalidArgumentError(
        '--values "score" must be a number when provided'
      );
    }
    return {
      label,
      ...(score !== undefined && score !== null ? { score } : {}),
    };
  });
}

/**
 * Resolve categorical values from whichever input form the caller supplied.
 *
 * - Returns `undefined` when neither `--value` nor `--values` was provided, so
 *   callers can distinguish "leave unchanged" (update) from "explicitly set".
 * - Rejects supplying both forms at once — they'd have ambiguous precedence.
 * - Always returns a non-empty list when it returns one; both parsers reject
 *   empty input.
 */
export function resolveCategoricalValues(
  options: CategoricalValueOptions
): CategoricalAnnotationValue[] | undefined {
  const hasFlags = options.value !== undefined && options.value.length > 0;
  const hasJson = options.values !== undefined;
  if (hasFlags && hasJson) {
    throw new InvalidArgumentError(
      "Specify categorical values with either repeatable --value flags or a single --values JSON payload, not both"
    );
  }
  if (hasFlags) {
    return options.value!.map(parseValueFlag);
  }
  if (hasJson) {
    return parseValuesJson(options.values!);
  }
  return undefined;
}

/**
 * Whether the caller supplied any categorical value input at all (either
 * form). Used to reject `--value`/`--values` on non-categorical configs.
 */
export function hasCategoricalValueInput(
  options: CategoricalValueOptions
): boolean {
  return (
    (options.value !== undefined && options.value.length > 0) ||
    options.values !== undefined
  );
}
