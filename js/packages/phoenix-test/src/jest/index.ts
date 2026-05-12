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

/**
 * Resolve jest globals lazily. Jest injects `describe`, `test`, `it`,
 * `beforeAll`, `afterAll` onto the global object during test runs; we read
 * them off `globalThis` so importing this module outside of a jest run
 * doesn't error.
 */
function getJestGlobals(): {
  describe: JestDescribe;
  test: JestTest;
  beforeAll: (fn: () => unknown | Promise<unknown>) => void;
  afterAll: (fn: () => unknown | Promise<unknown>) => void;
} {
  const g = globalThis as unknown as {
    describe?: JestDescribe;
    test?: JestTest;
    it?: JestTest;
    beforeAll?: (fn: () => unknown | Promise<unknown>) => void;
    afterAll?: (fn: () => unknown | Promise<unknown>) => void;
  };
  if (!g.describe || !g.beforeAll || !g.afterAll) {
    throw new Error(
      "phoenix-test/jest could not find Jest globals. Make sure this module " +
        "is imported from inside a Jest test file."
    );
  }
  const test = g.test ?? g.it;
  if (!test) {
    throw new Error("phoenix-test/jest could not find Jest's test/it.");
  }
  return {
    describe: g.describe,
    test,
    beforeAll: g.beforeAll,
    afterAll: g.afterAll,
  };
}

interface JestDescribe {
  (name: string, fn: () => void): void;
  only: (name: string, fn: () => void) => void;
  skip: (name: string, fn: () => void) => void;
}

interface JestTest {
  (
    name: string,
    fn: (...args: unknown[]) => unknown | Promise<unknown>,
    timeout?: number
  ): void;
  only: (
    name: string,
    fn: (...args: unknown[]) => unknown | Promise<unknown>,
    timeout?: number
  ) => void;
  skip: (
    name: string,
    fn: (...args: unknown[]) => unknown | Promise<unknown>,
    timeout?: number
  ) => void;
}

function buildHooks(): RunnerHooks {
  const g = getJestGlobals();
  return {
    describe: (name, fn) => g.describe(name, fn),
    describeOnly: (name, fn) => g.describe.only(name, fn),
    describeSkip: (name, fn) => g.describe.skip(name, fn),
    test: (name, fn, timeout) => g.test(name, fn, timeout),
    testOnly: (name, fn, timeout) => g.test.only(name, fn, timeout),
    testSkip: (name, fn, timeout) => g.test.skip(name, fn, timeout),
    beforeAll: (fn) => g.beforeAll(fn),
    afterAll: (fn) => g.afterAll(fn),
  };
}

export function describe(
  name: string,
  fn: () => void,
  config?: PhoenixSuiteConfig
): void {
  declareDescribe(buildHooks(), name, fn, config ?? {});
}
describe.only = (
  name: string,
  fn: () => void,
  config?: PhoenixSuiteConfig
): void => {
  declareDescribe(buildHooks(), name, fn, config ?? {}, "only");
};
describe.skip = (
  name: string,
  fn: () => void,
  config?: PhoenixSuiteConfig
): void => {
  declareDescribe(buildHooks(), name, fn, config ?? {}, "skip");
};

export function test<I extends KVMap = KVMap, E extends KVMap = KVMap>(
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  timeout?: number
): void {
  declareTest(buildHooks(), name, params, fn, "default", timeout);
}
test.only = <I extends KVMap = KVMap, E extends KVMap = KVMap>(
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  timeout?: number
): void => {
  declareTest(buildHooks(), name, params, fn, "only", timeout);
};
test.skip = <I extends KVMap = KVMap, E extends KVMap = KVMap>(
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  timeout?: number
): void => {
  declareTest(buildHooks(), name, params, fn, "skip", timeout);
};

test.each = <I extends KVMap, E extends KVMap>(
  table: PhoenixTestEachRow<I, E>[]
): ((name: string, fn: PhoenixTestFn<I, E>, timeout?: number) => void) => {
  return (name, fn, timeout) => {
    table.forEach((row, i) => {
      const interpolated = name.includes("%") ? name : `${name} #${i + 1}`;
      declareTest(
        buildHooks(),
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

/** `it` is the canonical alias for `test`. */
export const it = test;
