import { flushAnnotations } from "./helpers";
import {
  initializeSuite,
  postExperimentRun,
  runTaskWithTracing,
  teardownSuite,
} from "./phoenix";
import {
  currentSuite,
  popSuite,
  pushSuite,
  runStorage,
  type RunState,
  type SuiteState,
  type TestResult,
} from "./state";
import type {
  KVMap,
  PhoenixSuiteConfig,
  PhoenixTestArgs,
  PhoenixTestFn,
  PhoenixTestParams,
} from "./types";

/**
 * The minimum slice of a test runner (vitest or jest) the runner needs in
 * order to declare suites, tests, and lifecycle hooks.
 */
export interface RunnerHooks {
  describe: (name: string, fn: () => void) => void;
  describeOnly?: (name: string, fn: () => void) => void;
  describeSkip?: (name: string, fn: () => void) => void;
  test: (
    name: string,
    fn: (...args: unknown[]) => unknown | Promise<unknown>,
    timeout?: number
  ) => void;
  testOnly?: (
    name: string,
    fn: (...args: unknown[]) => unknown | Promise<unknown>,
    timeout?: number
  ) => void;
  testSkip?: (
    name: string,
    fn: (...args: unknown[]) => unknown | Promise<unknown>,
    timeout?: number
  ) => void;
  beforeAll: (fn: () => unknown | Promise<unknown>) => void;
  afterAll: (fn: () => unknown | Promise<unknown>) => void;
}

/** Variants exposed by `test` (and `.skip`/`.only`). */
type TestVariant = "default" | "only" | "skip";

/** Globally accessible registry of all suites we created in this process. */
const allSuites: SuiteState[] = [];

/** Drive a `describe(name, fn, config?)` invocation. */
export function declareDescribe(
  hooks: RunnerHooks,
  name: string,
  fn: () => void,
  config: PhoenixSuiteConfig = {},
  variant: TestVariant = "default"
): void {
  const describeFn =
    variant === "only"
      ? (hooks.describeOnly ?? hooks.describe)
      : variant === "skip"
        ? (hooks.describeSkip ?? hooks.describe)
        : hooks.describe;

  describeFn(name, () => {
    const suite: SuiteState = {
      name,
      config,
      registeredExamples: new Map(),
      exampleIdsByTest: new Map(),
      trackingDisabled: false,
      results: [],
      links: [],
    };
    pushSuite(suite);
    try {
      fn();
    } finally {
      popSuite();
    }
    allSuites.push(suite);

    hooks.beforeAll(async () => {
      await initializeSuite(suite);
    });
    hooks.afterAll(async () => {
      await teardownSuite(suite);
    });
  });
}

/** Drive a `test(name, params, fn)` invocation. */
export function declareTest<I extends KVMap, E extends KVMap>(
  hooks: RunnerHooks,
  name: string,
  params: PhoenixTestParams<I, E>,
  fn: PhoenixTestFn<I, E>,
  variant: TestVariant = "default",
  timeout?: number
): void {
  const suite = currentSuite();
  if (!suite) {
    throw new Error(
      "phoenix-test test() must be declared inside a describe() block"
    );
  }

  // Avoid silently overwriting an example registration when the same test name
  // is declared twice in the same suite.
  const uniqueName = ensureUniqueName(suite, name);
  suite.registeredExamples.set(uniqueName, {
    testName: uniqueName,
    params: params as PhoenixTestParams,
  });

  const testFn =
    variant === "only"
      ? (hooks.testOnly ?? hooks.test)
      : variant === "skip"
        ? (hooks.testSkip ?? hooks.test)
        : hooks.test;

  testFn(
    uniqueName,
    async () => {
      const run: RunState = {
        suite,
        testName: uniqueName,
        params: params as PhoenixTestParams,
        output: undefined,
        outputSet: false,
        annotations: [],
        startTime: new Date(),
        runMetadata: {},
      };
      const start = Date.now();
      let status: "passed" | "failed" = "passed";
      let thrown: unknown;
      await runStorage.run(run, async () => {
        const taskOutcome = await runTaskWithTracing(
          suite,
          uniqueName,
          async () => {
            const args: PhoenixTestArgs<I, E> = {
              input: params.input,
              expected: params.expected,
              metadata: params.metadata,
            };
            const result = await fn(args);
            // If the user returned a value and didn't call logOutput(),
            // adopt the return value as the run's output.
            if (
              result !== undefined &&
              !run.outputSet &&
              isPlainObjectOrPrimitive(result)
            ) {
              run.output = result;
              run.outputSet = true;
            }
            return result;
          }
        );
        run.traceId = taskOutcome.traceId;
        if ("error" in taskOutcome && taskOutcome.error) {
          status = "failed";
          run.error = taskOutcome.error.message;
          thrown = taskOutcome.error;
        }
        run.endTime = new Date();

        // The pass/fail annotation is recorded regardless of tracking mode
        // so it shows up consistently in the reporter summary.
        run.annotations.unshift({
          name: "pass",
          score: status === "passed",
          annotatorKind: "CODE",
        });

        const runId = await postExperimentRun(suite, run);
        run.runId = runId;
        await flushAnnotations(runId, run.annotations, suite);
      });

      const result: TestResult = {
        suiteName: suite.name,
        testName: uniqueName,
        status,
        output: run.outputSet ? run.output : undefined,
        annotations: run.annotations,
        error: run.error,
        durationMs: Date.now() - start,
      };
      suite.results.push(result);

      if (thrown) {
        throw thrown;
      }
    },
    timeout
  );
}

function isPlainObjectOrPrimitive(value: unknown): boolean {
  if (value === null) return true;
  const type = typeof value;
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "object"
  );
}

function ensureUniqueName(suite: SuiteState, name: string): string {
  if (!suite.registeredExamples.has(name)) {
    return name;
  }
  let i = 2;
  while (suite.registeredExamples.has(`${name} (${i})`)) {
    i++;
  }
  return `${name} (${i})`;
}

/** Suite registry exposed for reporters and the public summary helper. */
export function getAllSuites(): readonly SuiteState[] {
  return allSuites;
}

/**
 * Reset the suite registry. Reporters call this at the start of every test
 * run so module-cached state from previous watch invocations is released.
 */
export function clearAllSuites(): void {
  allSuites.length = 0;
}
