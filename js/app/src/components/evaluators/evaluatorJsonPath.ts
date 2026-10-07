import { isStringKeyedObject } from "@phoenix/typeUtils";
import { unescapeQuotedPathKey } from "@phoenix/utils/objectUtils";

/** What one step of a path selects. `[*]` is a slice with no bounds. */
type EvaluatorPathSelector =
  | { kind: "field"; key: string }
  | { kind: "index"; indices: number[] }
  | {
      kind: "slice";
      start: number | null;
      end: number | null;
      step: number | null;
    };

/** One step of an evaluator mapping path, with the range of text that wrote it. */
export type EvaluatorPathStep = EvaluatorPathSelector & {
  from: number;
  to: number;
};

const MAX_PATH_LENGTH = 1000;
const ROOT_MARKER = "$";
const RESERVED_WORDS = new Set(["where", "wherenot"]);
const BARE_AT_PATTERN = /(?:^|[.[])@(?:[.[]|$)/;
const INVALID_IDENTIFIER_PATTERN =
  /(?:^|\.)(?!\.)(?![a-zA-Z_])(?!\$)(?!\[)(?!`)./;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;
const QUOTED_KEY_PATTERN = /^\['((?:[^'\\]|\\.)*)'\]/;
const WILDCARD_PATTERN = /^\[\*\]/;
const INDEX_PATTERN = /^\[(-?\d+(?:,-?\d+)*)\]/;
const SLICE_PATTERN = /^\[(-?\d+)?:(-?\d+)?(?::(-?\d+)?)?\]/;

/**
 * Splits a mapping path into steps, accepting the subset of the server's
 * `validate_jsonpath` this side can evaluate: an optional `$`, dotted names,
 * `['quoted']` keys, `[n]` and `[n,m]` indices, `[*]`, and slices.
 *
 * @returns null for anything else, including paths the server would reject.
 */
export function parseEvaluatorPath(path: string): EvaluatorPathStep[] | null {
  if (
    path.length > MAX_PATH_LENGTH ||
    BARE_AT_PATTERN.test(path) ||
    INVALID_IDENTIFIER_PATTERN.test(path)
  ) {
    return null;
  }
  const steps: EvaluatorPathStep[] = [];
  let offset = path.startsWith(ROOT_MARKER) ? ROOT_MARKER.length : 0;
  let needsSeparator = offset > 0;
  while (offset < path.length) {
    const rest = path.slice(offset);
    if (rest.startsWith("[")) {
      const subscript = parseSubscript(rest);
      if (subscript === null) {
        return null;
      }
      steps.push({
        ...subscript.step,
        from: offset,
        to: offset + subscript.length,
      });
      offset += subscript.length;
      needsSeparator = true;
      continue;
    }
    if (needsSeparator) {
      if (!rest.startsWith(".")) {
        return null;
      }
      offset += 1;
    }
    const identifier = IDENTIFIER_PATTERN.exec(path.slice(offset))?.[0];
    if (identifier === undefined || RESERVED_WORDS.has(identifier)) {
      return null;
    }
    steps.push({
      kind: "field",
      key: identifier,
      from: offset,
      to: offset + identifier.length,
    });
    offset += identifier.length;
    needsSeparator = true;
  }
  return steps;
}

function parseSubscript(
  text: string
): { step: EvaluatorPathSelector; length: number } | null {
  const quoted = QUOTED_KEY_PATTERN.exec(text);
  if (quoted) {
    const key = unescapeQuotedPathKey(quoted[1]);
    // The server reads a quoted `*` as every field of an object.
    return key === "*"
      ? null
      : { step: { kind: "field", key }, length: quoted[0].length };
  }
  const wildcard = WILDCARD_PATTERN.exec(text);
  if (wildcard) {
    return {
      step: { kind: "slice", start: null, end: null, step: null },
      length: wildcard[0].length,
    };
  }
  const index = INDEX_PATTERN.exec(text);
  if (index) {
    return {
      step: { kind: "index", indices: index[1].split(",").map(Number) },
      length: index[0].length,
    };
  }
  const slice = SLICE_PATTERN.exec(text);
  if (slice) {
    const [matched, start, end, step] = slice;
    return {
      step: {
        kind: "slice",
        start: toBound(start),
        end: toBound(end),
        step: toBound(step),
      },
      length: matched.length,
    };
  }
  return null;
}

function toBound(text: string | undefined): number | null {
  return text === undefined ? null : Number(text);
}

export type EvaluatorPathMatches =
  | { status: "matched"; matches: unknown[] }
  | { status: "unmatched"; step: EvaluatorPathStep };

/**
 * Walks `steps` over `source` the way jsonpath_ng 1.8 does for the server's
 * `apply_input_mapping`: each step maps over every match so far, and a step
 * that matches nothing or raises fails the whole path.
 */
export function findEvaluatorPathMatches({
  source,
  steps,
}: {
  source: unknown;
  steps: readonly EvaluatorPathStep[];
}): EvaluatorPathMatches {
  let matches: unknown[] = [source];
  for (const step of steps) {
    const next: unknown[] = [];
    for (const match of matches) {
      const found = applyStep({ step, value: match });
      if (found === null) {
        return { status: "unmatched", step };
      }
      next.push(...found);
    }
    if (next.length === 0) {
      return { status: "unmatched", step };
    }
    matches = next;
  }
  return { status: "matched", matches };
}

/** What one step finds in one value, or null where the server raises. */
function applyStep({
  step,
  value,
}: {
  step: EvaluatorPathStep;
  value: unknown;
}): unknown[] | null {
  if (step.kind === "index") {
    return applyIndices({ indices: step.indices, value });
  }
  if (step.kind === "slice") {
    return applySlice({ slice: step, value });
  }
  // Own keys only: JSONPath never reaches `toString` and the like.
  return isStringKeyedObject(value) && Object.hasOwn(value, step.key)
    ? [value[step.key]]
    : [];
}

function applyIndices({
  indices,
  value,
}: {
  indices: readonly number[];
  value: unknown;
}): unknown[] | null {
  if (isPythonFalsy(value)) {
    return [];
  }
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? Array.from(value)
      : null;
  if (items === null) {
    if (!isStringKeyedObject(value)) {
      return null;
    }
    const size = Object.keys(value).length;
    return indices.some((index) => size > index) ? null : [];
  }
  const matches: unknown[] = [];
  for (const index of indices) {
    if (index >= items.length) {
      continue;
    }
    if (index < -items.length) {
      return null;
    }
    matches.push(items.at(index));
  }
  return matches;
}

function applySlice({
  slice,
  value,
}: {
  slice: { start: number | null; end: number | null; step: number | null };
  value: unknown;
}): unknown[] | null {
  if (value == null) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  const indices = getSliceIndices({ length: items.length, ...slice });
  return indices === null ? null : indices.map((index) => items[index]);
}

/** Python's `range(length)[start:end:step]`. */
function getSliceIndices({
  length,
  start,
  end,
  step,
}: {
  length: number;
  start: number | null;
  end: number | null;
  step: number | null;
}): number[] | null {
  const stride = step ?? 1;
  if (stride === 0) {
    return null;
  }
  const isForward = stride > 0;
  const lower = isForward ? 0 : -1;
  const upper = isForward ? length : length - 1;
  const clamp = (bound: number | null, unbounded: number) =>
    bound === null
      ? unbounded
      : bound < 0
        ? Math.max(bound + length, lower)
        : Math.min(bound, upper);
  const first = clamp(start, isForward ? lower : upper);
  const last = clamp(end, isForward ? upper : lower);
  const indices: number[] = [];
  for (
    let index = first;
    isForward ? index < last : index > last;
    index += stride
  ) {
    indices.push(index);
  }
  return indices;
}

function isPythonFalsy(value: unknown): boolean {
  if (value == null || value === false || value === 0 || value === "") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return isStringKeyedObject(value) && Object.keys(value).length === 0;
}
