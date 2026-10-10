import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * What one step of a path selects. `$` is the whole source wherever it sits,
 * a `*` among `keys` is every field of an object, and `[*]` is a slice with no
 * bounds.
 */
type EvaluatorPathSelector =
  | { kind: "root" }
  | { kind: "fields"; keys: string[] }
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

/** A path's steps, or where the server's `validate_jsonpath` rejects it. */
export type ParsedEvaluatorPath =
  | { isValid: true; steps: EvaluatorPathStep[] }
  | { isValid: false; errorAt: number };

const MAX_PATH_LENGTH = 1000;
const QUOTED_PATTERN = /'(?:[^'\\]|\\[^\n])*'|"(?:[^"\\]|\\[^\n])*"/g;
// Python's `$` also matches before a trailing newline.
const BARE_AT_PATTERN = /(?:^|[.[])@(?:[.[]|\n?$)/;
const INVALID_IDENTIFIER_PATTERN =
  /(?:^|\.)(?!\.)(?![a-zA-Z_])(?!\$)(?!\[)(?!`)(?!\*)[^\n]/;
const RESERVED_WORDS = new Set(["where", "wherenot"]);
const NAME_PATTERN =
  /(?:[a-zA-Z_@]|[\u{4E00}-\u{9FA5}]|[\u{1F600}-\u{1F64F}])(?:[a-zA-Z0-9_@-]|[\u{4E00}-\u{9FA5}]|[\u{1F600}-\u{1F64F}])*/uy;
const NUMBER_PATTERN = /-?\d+/y;
const QUOTED_NAME_PATTERN = /'((?:[^'\\]|\\[^\n])*)'|"((?:[^"\\]|\\[^\n])*)"/y;
const PUNCTUATION = new Set(["*", ".", "[", "]", "(", ")", "$", ",", ":"]);
const SKIPPED = new Set([" ", "\t", "\n"]);

/** Whether `key` can follow a `.` as it is, rather than as a quoted subscript. */
export function isPlainEvaluatorPathKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !RESERVED_WORDS.has(key);
}

type Token = {
  type: "name" | "number" | "punctuation";
  value: string;
  from: number;
  to: number;
};

class EvaluatorPathSyntaxError extends Error {
  constructor(readonly at: number) {
    super(`Invalid evaluator path at ${at}`);
  }
}

/**
 * Splits a mapping path into steps, accepting exactly what the server's
 * `validate_jsonpath` accepts: its dot-notation checks, jsonpath_ng's lexer,
 * and the parts of its grammar that build only root, child, field, index, and
 * slice nodes.
 */
export function parseEvaluatorPath(path: string): ParsedEvaluatorPath {
  try {
    checkDotNotation(path);
    return { isValid: true, steps: parseTokens(tokenize(path), path.length) };
  } catch (error) {
    if (error instanceof EvaluatorPathSyntaxError) {
      return { isValid: false, errorAt: error.at };
    }
    throw error;
  }
}

function checkDotNotation(path: string) {
  if (Array.from(path).length > MAX_PATH_LENGTH) {
    throw new EvaluatorPathSyntaxError(0);
  }
  const unquoted = path.replace(
    QUOTED_PATTERN,
    (quoted) => `${quoted[0]}${"_".repeat(quoted.length - 2)}${quoted[0]}`
  );
  const bareAt = BARE_AT_PATTERN.exec(unquoted);
  if (bareAt) {
    throw new EvaluatorPathSyntaxError(unquoted.indexOf("@", bareAt.index));
  }
  const identifier = INVALID_IDENTIFIER_PATTERN.exec(unquoted);
  if (identifier) {
    throw new EvaluatorPathSyntaxError(
      identifier.index + identifier[0].length - 1
    );
  }
}

function tokenize(path: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  const match = (pattern: RegExp) => {
    pattern.lastIndex = offset;
    return pattern.exec(path);
  };
  while (offset < path.length) {
    const char = path[offset];
    if (SKIPPED.has(char)) {
      offset += 1;
      continue;
    }
    const name = match(NAME_PATTERN);
    if (name) {
      if (RESERVED_WORDS.has(name[0])) {
        throw new EvaluatorPathSyntaxError(offset);
      }
      tokens.push(toToken("name", name[0], offset, name[0].length));
      offset += name[0].length;
      continue;
    }
    const number = match(NUMBER_PATTERN);
    if (number) {
      tokens.push(toToken("number", number[0], offset, number[0].length));
      offset += number[0].length;
      continue;
    }
    if (char === "'" || char === '"') {
      const quoted = match(QUOTED_NAME_PATTERN);
      if (!quoted) {
        throw new EvaluatorPathSyntaxError(offset);
      }
      const key = (quoted[1] ?? quoted[2]).replace(/\\([^\n])/gu, "$1");
      tokens.push(toToken("name", key, offset, quoted[0].length));
      offset += quoted[0].length;
      continue;
    }
    if (!PUNCTUATION.has(char) || path.startsWith("..", offset)) {
      throw new EvaluatorPathSyntaxError(offset);
    }
    tokens.push(toToken("punctuation", char, offset, 1));
    offset += 1;
  }
  return tokens;
}

function toToken(
  type: Token["type"],
  value: string,
  from: number,
  length: number
): Token {
  return { type, value, from, to: from + length };
}

function parseTokens(tokens: Token[], end: number): EvaluatorPathStep[] {
  let position = 0;
  const peek = (): Token | undefined => tokens[position];
  const fail = (): never => {
    throw new EvaluatorPathSyntaxError(peek()?.from ?? end);
  };
  const isPunctuation = (value: string, at = position) =>
    tokens[at]?.type === "punctuation" && tokens[at]?.value === value;
  const take = (): Token => {
    const token = peek() ?? fail();
    position += 1;
    return token;
  };
  const expect = (value: string): Token =>
    isPunctuation(value) ? take() : fail();
  const takeNames = (): string[] => {
    const keys = [take().value];
    while (isPunctuation(",")) {
      take();
      keys.push(peek()?.type === "name" ? take().value : fail());
    }
    return keys;
  };
  const takeBound = (): number | null =>
    peek()?.type === "number" ? Number(take().value) : null;

  const parseBracket = (): EvaluatorPathStep => {
    const { from } = expect("[");
    const next = peek();
    let selector: EvaluatorPathSelector;
    if (isPunctuation("*")) {
      take();
      selector = { kind: "slice", start: null, end: null, step: null };
    } else if (next?.type === "name") {
      selector = { kind: "fields", keys: takeNames() };
    } else if (
      next?.type === "number" &&
      (isPunctuation(",", position + 1) || isPunctuation("]", position + 1))
    ) {
      const indices = [Number(take().value)];
      while (isPunctuation(",")) {
        take();
        indices.push(peek()?.type === "number" ? Number(take().value) : fail());
      }
      selector = { kind: "index", indices };
    } else {
      const start = takeBound();
      expect(":");
      const stop = takeBound();
      let step: number | null = null;
      if (isPunctuation(":")) {
        take();
        step = takeBound();
      }
      selector = { kind: "slice", start, end: stop, step };
    }
    return { ...selector, from, to: expect("]").to };
  };

  const parseTerm = (): EvaluatorPathStep[] => {
    const token = peek() ?? fail();
    if (token.type === "name") {
      const keys = takeNames();
      return [
        { kind: "fields", keys, from: token.from, to: tokens[position - 1].to },
      ];
    }
    if (token.type === "number") {
      take();
      return [
        {
          kind: "fields",
          keys: [BigInt(token.value).toString()],
          from: token.from,
          to: token.to,
        },
      ];
    }
    switch (token.value) {
      case "$":
        take();
        return [{ kind: "root", from: token.from, to: token.to }];
      case "*":
        take();
        return [
          { kind: "fields", keys: ["*"], from: token.from, to: token.to },
        ];
      case "[":
        return [parseBracket()];
      case "(": {
        take();
        const steps = parsePath();
        expect(")");
        return steps;
      }
      default:
        return fail();
    }
  };

  const parsePath = (): EvaluatorPathStep[] => {
    const steps = parseTerm();
    for (;;) {
      if (isPunctuation(".")) {
        take();
        steps.push(...parseTerm());
      } else if (isPunctuation("[")) {
        steps.push(parseBracket());
      } else {
        return steps;
      }
    }
  };

  const steps = parsePath();
  if (position < tokens.length) {
    fail();
  }
  return steps;
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
  let matches: PathMatch[] = [{ value: source, root: source, isRoot: true }];
  for (const step of steps) {
    const next: PathMatch[] = [];
    for (const match of matches) {
      const found = applyStep({ step, match });
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
  return { status: "matched", matches: matches.map(({ value }) => value) };
}

/**
 * A value a path has reached, and the value `$` reads from it: the source,
 * unless a slice wrapped the source in a list, which jsonpath_ng does to
 * anything that is not one.
 */
type PathMatch = { value: unknown; root: unknown; isRoot: boolean };

/** What one step finds from one match, or null where the server raises. */
function applyStep({
  step,
  match,
}: {
  step: EvaluatorPathStep;
  match: PathMatch;
}): PathMatch[] | null {
  if (step.kind === "root") {
    return [{ value: match.root, root: match.root, isRoot: true }];
  }
  const { value } = match;
  const found =
    step.kind === "fields"
      ? applyFields({ keys: step.keys, value })
      : step.kind === "index"
        ? applyIndices({ indices: step.indices, value })
        : applySlice({ slice: step, value });
  const root =
    step.kind === "slice" && match.isRoot && !Array.isArray(value)
      ? [value]
      : match.root;
  return found?.map((item) => ({ value: item, root, isRoot: false })) ?? null;
}

function applyFields({
  keys,
  value,
}: {
  keys: readonly string[];
  value: unknown;
}): unknown[] {
  if (!isStringKeyedObject(value) || Array.isArray(value)) {
    return [];
  }
  // Own keys only: JSONPath never reaches `toString` and the like.
  return (keys.includes("*") ? Object.keys(value) : keys)
    .filter((key) => Object.hasOwn(value, key))
    .map((key) => value[key]);
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
