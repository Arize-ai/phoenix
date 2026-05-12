import {
  afterAll as vitestAfterAll,
  beforeAll as vitestBeforeAll,
  describe as vitestDescribe,
  test as vitestTest,
} from "vitest";

import { declareDescribe, declareTest, type RunnerHooks } from "../core/runner";
import type {
  KVMap,
  PhoenixSuiteConfig,
  PhoenixTestEachRow,
  PhoenixTestFn,
  PhoenixTestParams,
} from "../core/types";

export type {
  Annotation,
  AnnotatorKind,
  EvaluatorResult,
  KVMap,
  PhoenixSuiteConfig,
  PhoenixTestArgs,
  PhoenixTestConfig,
  PhoenixTestEachRow,
  PhoenixTestFn,
  PhoenixTestParams,
} from "../core/types";

export { logAnnotation, logOutput, wrapEvaluator } from "../core/helpers";

const hooks: RunnerHooks = {
  describe: (name, fn) => vitestDescribe(name, fn),
  describeOnly: (name, fn) => vitestDescribe.only(name, fn),
  describeSkip: (name, fn) => vitestDescribe.skip(name, fn),
  test: (name, fn, timeout) => vitestTest(name, fn, timeout),
  testOnly: (name, fn, timeout) => vitestTest.only(name, fn, timeout),
  testSkip: (name, fn, timeout) => vitestTest.skip(name, fn, timeout),
  beforeAll: (fn) => vitestBeforeAll(fn),
  afterAll: (fn) => vitestAfterAll(fn),
};

/**
 * Declare a Phoenix test suite. The suite name doubles as the dataset and
 * experiment name on the Phoenix server.
 *
 * @example
 * ```ts
 * import * as px from "@arizeai/phoenix-test";
 *
 * px.describe("generate sql demo", () => {
 *   px.test("offtopic input", { input: { ... } }, async ({ input }) => {
 *     // ...
 *   });
 * }, { metadata: { model: "gpt-4o-mini" } });
 * ```
 */
export function describe(
  name: string,
  fn: () => void,
  config?: PhoenixSuiteConfig
): void {
  declareDescribe(hooks, name, fn, config ?? {});
}
/** Run only this suite (matches `vitest`'s `describe.only`). */
describe.only = (
  name: string,
  fn: () => void,
  config?: PhoenixSuiteConfig
): void => {
  declareDescribe(hooks, name, fn, config ?? {}, "only");
};
/** Skip this suite (matches `vitest`'s `describe.skip`). */
describe.skip = (
  name: string,
  fn: () => void,
  config?: PhoenixSuiteConfig
): void => {
  declareDescribe(hooks, name, fn, config ?? {}, "skip");
};

/**
 * Declare a single Phoenix test case. The `params` argument carries the
 * `input` and `expected` output that become the dataset example.
 */
export function test<I extends KVMap = KVMap, E extends KVMap = KVMap>(
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  timeout?: number
): void {
  declareTest(hooks, name, params, fn, "default", timeout);
}
test.only = <I extends KVMap = KVMap, E extends KVMap = KVMap>(
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  timeout?: number
): void => {
  declareTest(hooks, name, params, fn, "only", timeout);
};
test.skip = <I extends KVMap = KVMap, E extends KVMap = KVMap>(
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  timeout?: number
): void => {
  declareTest(hooks, name, params, fn, "skip", timeout);
};

/**
 * Run the same test function across many examples. The returned function
 * accepts a name template and the test body.
 */
test.each = <I extends KVMap, E extends KVMap>(
  table: PhoenixTestEachRow<I, E>[]
): ((name: string, fn: PhoenixTestFn<I, E>, timeout?: number) => void) => {
  return (name, fn, timeout) => {
    table.forEach((row, i) => {
      const interpolated = interpolateName(name, row, i);
      declareTest(
        hooks,
        interpolated,
        {
          id: row.id,
          input: row.input,
          expected: row.expected,
          metadata: row.metadata,
          repetitions: row.repetitions,
          dryRun: row.dryRun,
        },
        fn,
        "default",
        timeout
      );
    });
  };
};

/** `it` is the canonical alias for `test` in vitest. */
export const it = test;

function interpolateName(
  name: string,
  row: PhoenixTestEachRow,
  index: number
): string {
  // Vitest's `test.each` supports `%i`, `%s`, `%j`, etc. We do a minimal
  // substitution that's good enough for surface parity.
  if (!name.includes("%")) {
    // append the row index when the user didn't ask for a placeholder
    return `${name} #${index + 1}`;
  }
  const replacements: Array<[RegExp, string]> = [
    [/%i/g, String(index)],
    [/%s/g, JSON.stringify(row.input)],
    [/%j/g, JSON.stringify(row)],
  ];
  let out = name;
  for (const [pattern, value] of replacements) {
    out = out.replace(pattern, value);
  }
  return out;
}
