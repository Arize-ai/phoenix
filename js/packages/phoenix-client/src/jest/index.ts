import { createTestApi } from "../testing/define-api";
import type { RunnerHooks } from "../testing/runner";

export type {
  PhoenixDescribe,
  PhoenixTest,
  PhoenixTestApi,
  PhoenixTestEach,
} from "../testing/define-api";

export type {
  AcceptanceCriterion,
  AcceptanceMetric,
  AcceptanceResult,
  Annotation,
  AnnotatorKind,
  EvaluationParams,
  EvaluationResult,
  Evaluator,
  EvaluatorResult,
  KVMap,
  ReferenceOutput,
  SuiteConfig,
  TestArgs,
  TestConfig,
  TestEachRow,
  TestFn,
  TestParams,
  TestParamsBase,
} from "../testing/types";

export {
  evaluate,
  logAnnotation,
  logOutput,
  traceEvaluator,
} from "../testing/helpers";

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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- jest injects these globals onto globalThis at runtime
  const g = globalThis as unknown as {
    describe?: JestDescribe;
    test?: JestTest;
    it?: JestTest;
    beforeAll?: (fn: () => unknown | Promise<unknown>) => void;
    afterAll?: (fn: () => unknown | Promise<unknown>) => void;
  };
  if (!g.describe || !g.beforeAll || !g.afterAll) {
    throw new Error(
      "@arizeai/phoenix-client/jest could not find Jest globals. Make sure this module " +
        "is imported from inside a Jest test file."
    );
  }
  const test = g.test ?? g.it;
  if (!test) {
    throw new Error(
      "@arizeai/phoenix-client/jest could not find Jest's test/it."
    );
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

/**
 * Build the runner hooks from the (lazily-resolved) jest globals. Memoized so
 * repeated declarations don't re-read `globalThis` on every call; jest injects
 * its globals once per worker before any test file is evaluated.
 */
let cachedHooks: RunnerHooks | undefined;
function getHooks(): RunnerHooks {
  if (cachedHooks) return cachedHooks;
  const g = getJestGlobals();
  cachedHooks = {
    describe: (name, fn) => g.describe(name, fn),
    describeOnly: (name, fn) => g.describe.only(name, fn),
    describeSkip: (name, fn) => g.describe.skip(name, fn),
    test: (name, fn, timeout) => g.test(name, fn, timeout),
    testOnly: (name, fn, timeout) => g.test.only(name, fn, timeout),
    testSkip: (name, fn, timeout) => g.test.skip(name, fn, timeout),
    beforeAll: (fn) => g.beforeAll(fn),
    afterAll: (fn) => g.afterAll(fn),
  };
  return cachedHooks;
}

export const { describe, test, it } = createTestApi(getHooks);
