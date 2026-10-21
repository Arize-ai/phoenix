import { assertUnreachable } from "@phoenix/typeUtils";

import type { EvaluatorPathStep } from "./evaluatorJsonPath";
import { parseEvaluatorPath } from "./evaluatorJsonPath";

/** What one item of the list at `listPath` is called: `messages` → message. */
export function toItemNoun(listPath: string): string {
  return singularize(toListWords(listPath));
}

/** The list's own name in words: `tool_calls` → tool calls. */
export function toListWords(listPath: string): string {
  const parsed = parseEvaluatorPath(listPath);
  const lastStep = parsed.isValid ? parsed.steps.at(-1) : undefined;
  const name =
    lastStep?.kind === "fields" && lastStep.keys.length === 1
      ? (lastStep.keys[0].split(".").at(-1) ?? "")
      : "";
  const words = toWords(name);
  return /[a-z]/.test(words) ? words : "items";
}

export function toWords(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .trim()
    .toLowerCase();
}

export function capitalize(words: string): string {
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

const SINGULAR_ENDINGS: readonly [RegExp, string][] = [
  [/ies$/, "y"],
  [/(ss|us|is)$/, "$1"],
  [/(ch|sh|x|ss|us)es$/, "$1"],
  [/s$/, ""],
];

function singularize(words: string): string {
  const rule = SINGULAR_ENDINGS.find(([ending]) => ending.test(words));
  return rule === undefined ? words : words.replace(rule[0], rule[1]);
}

/**
 * What a path that reads several values at once does with them, in words.
 *
 * A `*`, a slice or a union fans out over what it selects, and the server
 * binds every match as one list — except a single match, which it binds on
 * its own, so that one is only counted. Naming what the `*` does, rather than
 * the list type the result happens to be, is what tells an author what it is
 * for. Null for a path that reads one value.
 */
export function describeEvaluatorPathFanOut({
  path,
  matchCount,
}: {
  path: string;
  matchCount: number;
}): string | null {
  const parsed = parseEvaluatorPath(path);
  if (!parsed.isValid) {
    return null;
  }
  const fanOut = parsed.steps.find(isFanOutStep);
  if (fanOut === undefined) {
    return null;
  }
  const listPath = path.slice(0, fanOut.from);
  const isOverFields = fanOut.kind === "fields";
  const noun = isOverFields ? "field" : toItemNoun(listPath);
  const readsItems = fanOut === parsed.steps.at(-1);
  if (matchCount === 1) {
    return `1 ${readsItems ? noun : "value"}`;
  }
  if (!readsItems) {
    return `A list of each ${noun}'s value`;
  }
  const kept = describeKeptItems({ step: fanOut, noun });
  return kept === null
    ? `A list of ${matchCount} ${isOverFields ? "fields" : toListWords(listPath)}`
    : `A list of ${kept}`;
}

/**
 * Which items a `*` or a slice keeps, said the way an author would ask for
 * them: every turn, or every turn but the last. Null for a selection that
 * reads no plainer than its count, such as a union or a stepped slice.
 */
function describeKeptItems({
  step,
  noun,
}: {
  step: EvaluatorPathStep;
  noun: string;
}): string | null {
  if (step.kind === "fields") {
    return step.keys.includes("*") ? `every ${noun}` : null;
  }
  if (step.kind !== "slice" || step.step !== null) {
    return null;
  }
  const { start, end } = step;
  if (start === null && end === null) {
    return `every ${noun}`;
  }
  if (start === null && end !== null && end < 0) {
    return end === -1
      ? `every ${noun} but the last`
      : `every ${noun} but the last ${-end}`;
  }
  if (end === null && start !== null && start > 0) {
    return start === 1
      ? `every ${noun} but the first`
      : `every ${noun} but the first ${start}`;
  }
  return null;
}

/**
 * The heading for the level a `*` opens: the fields every item has between
 * them. Null for a level that is not a wildcard's.
 */
export function describeEvaluatorPathWildcardLevel(
  containerPath: string
): string | null {
  const parsed = parseEvaluatorPath(containerPath);
  const last = parsed.isValid ? parsed.steps.at(-1) : undefined;
  if (last === undefined || !isWildcardStep(last) || last.from === 0) {
    return null;
  }
  const listPath = containerPath.slice(0, last.from);
  const noun = last.kind === "fields" ? "field" : toItemNoun(listPath);
  return `Each ${noun} in ${listPath}`;
}

function isFanOutStep(step: EvaluatorPathStep): boolean {
  switch (step.kind) {
    case "slice":
      return true;
    case "index":
      return step.indices.length > 1;
    case "fields":
      return step.keys.length > 1 || step.keys.includes("*");
    case "root":
      return false;
    default:
      return assertUnreachable(step);
  }
}

function isWildcardStep(step: EvaluatorPathStep): boolean {
  return (
    (step.kind === "slice" &&
      step.start === null &&
      step.end === null &&
      step.step === null) ||
    (step.kind === "fields" && step.keys.includes("*"))
  );
}
