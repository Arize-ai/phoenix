import { declareDescribe, declareTest, type RunnerHooks } from "./runner";
import type {
  KVMap,
  SuiteConfig,
  TestEachRow,
  TestFn,
  TestParams,
} from "./types";

/**
 * Build the public `describe`/`test`/`it` API for a runner adapter.
 *
 * Both the jest and vitest entrypoints expose the identical surface; the only
 * thing that differs between them is how the {@link RunnerHooks} are obtained
 * (vitest imports them statically, jest resolves them lazily from globals).
 * That difference is captured by `getHooks`, which is invoked once per
 * declaration so adapters are free to resolve hooks lazily.
 */
export function createTestApi(getHooks: () => RunnerHooks) {
  /**
   * Declare a Phoenix test suite. The suite name doubles as the dataset and
   * experiment name on the Phoenix server.
   *
   * @example
   * ```ts
   * import * as px from "@arizeai/phoenix-client/vitest";
   *
   * px.describe("generate sql demo", () => {
   *   px.test("offtopic input", { input: { ... } }, async ({ input }) => {
   *     // ...
   *   });
   * }, { metadata: { model: "gpt-4o-mini" } });
   * ```
   */
  function describe(name: string, fn: () => void, config?: SuiteConfig): void {
    declareDescribe(getHooks(), name, fn, config ?? {});
  }
  /** Run only this suite (matches the runner's `describe.only`). */
  describe.only = (
    name: string,
    fn: () => void,
    config?: SuiteConfig
  ): void => {
    declareDescribe(getHooks(), name, fn, config ?? {}, "only");
  };
  /** Skip this suite (matches the runner's `describe.skip`). */
  describe.skip = (
    name: string,
    fn: () => void,
    config?: SuiteConfig
  ): void => {
    declareDescribe(getHooks(), name, fn, config ?? {}, "skip");
  };

  /**
   * Declare a single Phoenix test case. The `params` argument carries the
   * `input` and `expected` output that become the dataset example.
   */
  function test<I extends KVMap = KVMap, E extends KVMap = KVMap>(
    name: string,
    params: TestParams<I, E>,
    fn: TestFn<I, E>,
    timeout?: number
  ): void {
    declareTest(getHooks(), name, params, fn, "default", timeout);
  }
  /** Run only this test case (matches the runner's `test.only`). */
  test.only = <I extends KVMap = KVMap, E extends KVMap = KVMap>(
    name: string,
    params: TestParams<I, E>,
    fn: TestFn<I, E>,
    timeout?: number
  ): void => {
    declareTest(getHooks(), name, params, fn, "only", timeout);
  };
  /** Skip this test case (matches the runner's `test.skip`). */
  test.skip = <I extends KVMap = KVMap, E extends KVMap = KVMap>(
    name: string,
    params: TestParams<I, E>,
    fn: TestFn<I, E>,
    timeout?: number
  ): void => {
    declareTest(getHooks(), name, params, fn, "skip", timeout);
  };
  /**
   * Run the same test function across many examples. The returned function
   * accepts a name template and the test body.
   */
  test.each = <I extends KVMap, E extends KVMap>(
    table: TestEachRow<I, E>[]
  ): ((
    name: string | ((row: TestEachRow<I, E>, index: number) => string),
    fn: TestFn<I, E>,
    timeout?: number
  ) => void) => {
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
            expected: row.expected,
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

  /** `it` is the canonical alias for `test`. */
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
