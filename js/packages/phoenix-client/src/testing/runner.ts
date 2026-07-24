import {
  createAcceptanceFailureError,
  evaluateAcceptanceCriteria,
} from "./acceptance";
import { flushAnnotations } from "./helpers";
import {
  initializeSuite,
  postExperimentRun,
  resolveRepetitions,
  runTaskWithTracing,
  teardownSuite,
} from "./phoenix-test-tracking";
import { writeSuiteSummaryArtifact } from "./report-artifacts";
import {
  currentSuite,
  popSuite,
  pushSuite,
  runStorage,
  type RunState,
  type SuiteState,
  type TestResult,
} from "./state";
import {
  type KVMap,
  resolveReference,
  type SuiteConfig,
  type TestArgs,
  type TestFn,
  type TestParams,
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
  config: SuiteConfig = {},
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
      let teardownError: unknown;
      let acceptanceError: Error | undefined;
      try {
        await teardownSuite(suite);
      } catch (err) {
        teardownError = err;
      }
      try {
        suite.acceptanceResults = evaluateAcceptanceCriteria({
          criteria: suite.config.acceptanceCriteria,
          results: suite.results,
        });
        acceptanceError = createAcceptanceFailureError(suite.acceptanceResults);
      } finally {
        writeSuiteSummaryArtifact(suite);
      }
      if (teardownError) {
        throw teardownError;
      }
      if (acceptanceError) {
        throw acceptanceError;
      }
    });
  });
}

/** Drive a `test(name, params, fn)` invocation. */
export function declareTest<Input extends KVMap, Expected extends KVMap>(
  hooks: RunnerHooks,
  name: string,
  params: TestParams<Input, Expected>,
  fn: TestFn<Input, Expected>,
  variant: TestVariant = "default",
  timeout?: number
): void {
  const suite = currentSuite();
  if (!suite) {
    throw new Error(
      "Phoenix eval test() must be declared inside a describe() block"
    );
  }

  // Collapse the `expected` / `reference` / `output` aliases into the single
  // canonical `expected` slot up front, so every downstream consumer (dataset
  // upload, evaluator params, test args) reads one field.
  params = normalizeReferenceOutput(params);

  // A per-test `dryRun` opts the case out of Phoenix entirely: no dataset
  // example, no experiment run, no annotations — it runs as an ordinary
  // local test. Suite-level dryRun (or PHOENIX_TEST_TRACKING=false) is
  // handled in `initializeSuite`, which never uploads anything anyway.
  const isDryRun = !!params.dryRun;

  // Avoid silently overwriting an example registration when the same test name
  // is declared twice in the same suite.
  const uniqueName = ensureUniqueName(suite, name);
  // Skipped cases never run, and registering them would still upload their
  // example to the tracked dataset via `initializeSuite()` — contradicting the
  // skip contract and letting unfinished/flaky cases mutate the dataset. Dry-run
  // cases opt out of Phoenix entirely. Neither should register an example.
  if (!isDryRun && variant !== "skip") {
    suite.registeredExamples.set(uniqueName, {
      testName: uniqueName,
      params: params as TestParams,
    });
  }

  const repetitions = isDryRun
    ? 1
    : resolveRepetitions(params.repetitions, suite);
  suite.maxRepetitions = Math.max(suite.maxRepetitions ?? 1, repetitions);

  const testFn =
    variant === "only"
      ? (hooks.testOnly ?? hooks.test)
      : variant === "skip"
        ? (hooks.testSkip ?? hooks.test)
        : hooks.test;

  for (let rep = 1; rep <= repetitions; rep++) {
    const runnerName =
      repetitions > 1
        ? `${uniqueName} [rep ${rep}/${repetitions}]`
        : uniqueName;
    testFn(
      runnerName,
      async () => {
        await executeRun({
          suite,
          runnerName,
          logicalName: uniqueName,
          repetitionNumber: rep,
          repetitions,
          dryRun: isDryRun,
          params: params as TestParams,
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- erasing generic Input/Expected to the base TestFn for the runner
          fn: fn as TestFn,
        });
      },
      timeout
    );
  }
}

/** Execute a single (possibly-repeated) run of a declared test. */
async function executeRun(opts: {
  suite: SuiteState;
  runnerName: string;
  logicalName: string;
  repetitionNumber: number;
  repetitions: number;
  dryRun: boolean;
  params: TestParams;
  fn: TestFn;
}): Promise<void> {
  const { suite, runnerName, logicalName, repetitionNumber, repetitions } =
    opts;
  const run: RunState = {
    suite,
    testName: runnerName,
    logicalName,
    repetitionNumber,
    dryRun: opts.dryRun,
    params: opts.params,
    output: undefined,
    outputSet: false,
    annotations: [],
    startTime: new Date(),
    runMetadata: {},
  };
  const start = Date.now();
  let status: "passed" | "failed" = "passed";
  let thrown: unknown;
  let testError: string | undefined;
  await runStorage.run(run, async () => {
    const taskOutcome = await runTaskWithTracing(
      suite,
      runnerName,
      async () => {
        const args: TestArgs = {
          input: opts.params.input,
          expected: opts.params.expected,
          metadata: opts.params.metadata,
        };
        const result = await opts.fn(args);
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
      testError = taskOutcome.error.message;
      if (taskOutcome.isTaskError) {
        run.error = taskOutcome.error.message;
      }
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
    testName: runnerName,
    status,
    output: run.outputSet ? run.output : undefined,
    annotations: run.annotations,
    error: testError,
    durationMs: Date.now() - start,
    repetitionNumber: repetitions > 1 ? repetitionNumber : undefined,
    repetitions: repetitions > 1 ? repetitions : undefined,
    dryRun: opts.dryRun || undefined,
    traceId: run.traceId,
    runId: run.runId,
    exampleId: suite.exampleIdsByTest.get(logicalName)?.exampleId,
  };
  suite.results.push(result);

  if (thrown) {
    throw thrown;
  }
}

/**
 * Return a copy of `params` with the reference output collapsed onto the
 * canonical `expected` key and the `reference` / `output` aliases dropped.
 */
function normalizeReferenceOutput<Input extends KVMap, Expected extends KVMap>(
  params: TestParams<Input, Expected>
): TestParams<Input, Expected> {
  const expected = resolveReference(params);
  const { reference: _reference, output: _output, ...rest } = params;
  return { ...rest, expected };
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
