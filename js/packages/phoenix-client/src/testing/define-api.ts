import { declareDescribe, declareTest, type RunnerHooks } from "./runner";
import {
  type KVMap,
  resolveReference,
  type SuiteConfig,
  type TestEachRow,
  type TestFn,
  type TestParams,
} from "./types";

/**
 * Declare Phoenix eval test suites.
 *
 * Drop-in replacement for the test runner's own `describe`. The suite name
 * doubles as the dataset and experiment name on the Phoenix server, and the
 * optional {@link SuiteConfig} controls dataset naming, repetitions, dry-run
 * mode, and CI acceptance criteria.
 *
 * @example
 * ```ts
 * import * as px from "@arizeai/phoenix-client/vitest";
 *
 * px.describe("generate sql demo", () => {
 *   px.test("offtopic input", { input: { question: "hi" } }, async ({ input }) => {
 *     // ...
 *   });
 * }, { metadata: { model: "gpt-4o-mini" } });
 * ```
 */
export interface PhoenixDescribe {
  /**
   * Declare a Phoenix eval test suite.
   *
   * @param name - Suite name; doubles as the dataset / experiment name on Phoenix.
   * @param fn - Suite body that declares its `test` / `it` cases.
   * @param config - Optional suite-level config (dataset name, repetitions, dry-run, acceptance criteria).
   */
  (name: string, fn: () => void, config?: SuiteConfig): void;
  /**
   * Run only this suite, skipping all sibling suites
   * (matches the runner's `describe.only`).
   *
   * @param name - Suite name; doubles as the dataset / experiment name on Phoenix.
   * @param fn - Suite body that declares its `test` / `it` cases.
   * @param config - Optional suite-level config.
   */
  only(name: string, fn: () => void, config?: SuiteConfig): void;
  /**
   * Skip this suite entirely (matches the runner's `describe.skip`). No dataset
   * or experiment is created on Phoenix.
   *
   * @param name - Suite name; doubles as the dataset / experiment name on Phoenix.
   * @param fn - Suite body (not executed).
   * @param config - Optional suite-level config.
   */
  skip(name: string, fn: () => void, config?: SuiteConfig): void;
}

/**
 * The test body returned by {@link PhoenixTest.each} after a table is bound.
 *
 * @param name - Test name, or a template (`%i` / `%s` / `%j`), or a function
 *   that derives the name from the row and its index.
 * @param fn - The test handler, run once per row in the bound table.
 * @param timeout - Optional per-test timeout in milliseconds.
 */
export type PhoenixTestEach<
  Input extends KVMap = KVMap,
  Expected extends KVMap = KVMap,
> = (
  name: string | ((row: TestEachRow<Input, Expected>, index: number) => string),
  fn: TestFn<Input, Expected>,
  timeout?: number
) => void;

/**
 * Declare a single Phoenix eval test case.
 *
 * Drop-in replacement for the test runner's own `test` / `it`. The `params`
 * argument carries the `input` and the reference output (`expected` /
 * `reference` / `output`) that become the dataset example; whatever the handler
 * returns (or passes to `logOutput()`) is recorded as the experiment run's
 * output and made available to evaluators.
 *
 * `it` is the canonical alias for `test`; the two are identical.
 *
 * @example
 * ```ts
 * px.test(
 *   "summarizes the article",
 *   { input: { article }, expected: { summary } },
 *   async ({ input, expected }) => {
 *     const output = await summarize(input.article);
 *     px.logOutput(output);
 *     await px.evaluate({ name: "matches", evaluate: () => output === expected.summary });
 *   }
 * );
 * ```
 */
export interface PhoenixTest {
  /**
   * Declare a single Phoenix eval test case.
   *
   * @param name - Test case name; doubles as the dataset example label.
   * @param params - Inline `input` and reference output that become the dataset example.
   * @param fn - Test handler; receives `{ input, expected, metadata }`.
   * @param timeout - Optional per-test timeout in milliseconds.
   */
  <Input extends KVMap = KVMap, Expected extends KVMap = KVMap>(
    name: string,
    params: TestParams<Input, Expected>,
    fn: TestFn<Input, Expected>,
    timeout?: number
  ): void;
  /**
   * Run only this test case, skipping its siblings
   * (matches the runner's `test.only`).
   *
   * @param name - Test case name; doubles as the dataset example label.
   * @param params - Inline `input` and reference output that become the dataset example.
   * @param fn - Test handler; receives `{ input, expected, metadata }`.
   * @param timeout - Optional per-test timeout in milliseconds.
   */
  only<Input extends KVMap = KVMap, Expected extends KVMap = KVMap>(
    name: string,
    params: TestParams<Input, Expected>,
    fn: TestFn<Input, Expected>,
    timeout?: number
  ): void;
  /**
   * Skip this test case (matches the runner's `test.skip`). No dataset example
   * or experiment run is created on Phoenix.
   *
   * @param name - Test case name; doubles as the dataset example label.
   * @param params - Inline `input` and reference output (not used while skipped).
   * @param fn - Test handler (not executed).
   * @param timeout - Optional per-test timeout in milliseconds.
   */
  skip<Input extends KVMap = KVMap, Expected extends KVMap = KVMap>(
    name: string,
    params: TestParams<Input, Expected>,
    fn: TestFn<Input, Expected>,
    timeout?: number
  ): void;
  /**
   * Run the same test handler across many examples. Returns a function that
   * takes a name (or template / name-builder) and the shared test body; each
   * row in `table` becomes its own dataset example and experiment run.
   *
   * @param table - Rows of `{ input, expected?, metadata?, ... }` to fan out over.
   * @returns A {@link PhoenixTestEach} that binds the name and shared handler.
   *
   * @example
   * ```ts
   * px.test.each([
   *   { input: { a: 1, b: 2 }, expected: { sum: 3 } },
   *   { input: { a: 2, b: 2 }, expected: { sum: 4 } },
   * ])("adds %j", async ({ input, expected }) => {
   *   // ...
   * });
   * ```
   */
  each<Input extends KVMap, Expected extends KVMap>(
    table: TestEachRow<Input, Expected>[]
  ): PhoenixTestEach<Input, Expected>;
}

/** The public testing surface returned by {@link createTestApi}. */
export interface PhoenixTestApi {
  /** Declare a Phoenix eval test suite. See {@link PhoenixDescribe}. */
  describe: PhoenixDescribe;
  /** Declare a Phoenix eval test case. See {@link PhoenixTest}. */
  test: PhoenixTest;
  /** Canonical alias for {@link PhoenixTestApi.test}. */
  it: PhoenixTest;
}

/**
 * Build the public `describe`/`test`/`it` API for a runner adapter.
 *
 * Both the jest and vitest entrypoints expose the identical surface; the only
 * thing that differs between them is how the {@link RunnerHooks} are obtained
 * (vitest imports them statically, jest resolves them lazily from globals).
 * That difference is captured by `getHooks`, which is invoked once per
 * declaration so adapters are free to resolve hooks lazily.
 *
 * The JSDoc that surfaces in editors lives on the {@link PhoenixDescribe} and
 * {@link PhoenixTest} interfaces rather than the implementations below, so the
 * docs survive the `export const { describe, test, it } = createTestApi(...)`
 * destructuring in each adapter.
 */
export function createTestApi(getHooks: () => RunnerHooks): PhoenixTestApi {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable base is augmented with .only/.skip below to satisfy PhoenixDescribe
  const describe = ((
    name: string,
    fn: () => void,
    config?: SuiteConfig
  ): void => {
    declareDescribe(getHooks(), name, fn, config ?? {});
  }) as PhoenixDescribe;
  describe.only = (name, fn, config) => {
    declareDescribe(getHooks(), name, fn, config ?? {}, "only");
  };
  describe.skip = (name, fn, config) => {
    declareDescribe(getHooks(), name, fn, config ?? {}, "skip");
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callable base is augmented with .only/.skip below to satisfy PhoenixTest
  const test = (<Input extends KVMap = KVMap, Expected extends KVMap = KVMap>(
    name: string,
    params: TestParams<Input, Expected>,
    fn: TestFn<Input, Expected>,
    timeout?: number
  ): void => {
    declareTest(getHooks(), name, params, fn, "default", timeout);
  }) as PhoenixTest;
  test.only = (name, params, fn, timeout) => {
    declareTest(getHooks(), name, params, fn, "only", timeout);
  };
  test.skip = (name, params, fn, timeout) => {
    declareTest(getHooks(), name, params, fn, "skip", timeout);
  };
  test.each = <Input extends KVMap, Expected extends KVMap>(
    table: TestEachRow<Input, Expected>[]
  ): PhoenixTestEach<Input, Expected> => {
    return (name, fn, timeout) => {
      table.forEach((row, i) => {
        const testName =
          typeof name === "function"
            ? name(row, i)
            : interpolateName(name, row, i);
        declareTest(
          getHooks(),
          testName,
          {
            id: row.id,
            input: row.input,
            expected: resolveReference(row),
            metadata: row.metadata,
            splits: row.splits,
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

  // `it` is the canonical alias for `test`.
  const it = test;

  return { describe, test, it };
}

/**
 * Interpolate a `test.each` name template for a single row. Supports the
 * common `%i`/`%s`/`%j` placeholders for surface parity with the underlying
 * runners; when no placeholder is present the 1-based row index is appended.
 */
function interpolateName(
  name: string,
  row: TestEachRow,
  index: number
): string {
  if (!name.includes("%")) {
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
