import type { PhoenixClient } from "@arizeai/phoenix-client";

/** A JSON-serializable map. */
export type KVMap = Record<string, unknown>;

/**
 * Inline parameters supplied alongside a single test case.
 *
 * `input` is bound to the dataset example's input field. When recorded to
 * Phoenix this becomes the example's `input`.
 *
 * `expected` is the reference output. When recorded to Phoenix this
 * becomes the example's `output` and is exposed to evaluators as
 * `expected` on `EvaluatorParams`.
 */
export interface PhoenixTestParams<
  I extends KVMap = KVMap,
  E extends KVMap = KVMap,
> {
  /** Optional stable example id; used to upsert dataset examples between runs. */
  id?: string;
  /** Input for the example. Required. */
  input: I;
  /** Reference (expected) output for the example. Optional. */
  expected?: E;
  /** Additional metadata stored on the dataset example and run. */
  metadata?: KVMap;
  /** Per-test config (tags + metadata recorded on the run). */
  config?: PhoenixTestConfig;
  /**
   * Number of times to run this test case. Each repetition becomes a
   * separate experiment run against the same dataset example (carrying a
   * distinct `repetition_number`). Overrides the suite-level `repetitions`.
   * Defaults to the suite value, then `PHOENIX_TEST_REPETITIONS`, then `1`.
   */
  repetitions?: number;
  /**
   * When `true`, this test runs as an ordinary local test only — no dataset
   * example is created and no experiment run or annotations are uploaded to
   * Phoenix. Useful for scaffolding a case before it's ready to track.
   */
  dryRun?: boolean;
}

/** Per-test runtime configuration. */
export interface PhoenixTestConfig {
  tags?: string[];
  metadata?: KVMap;
}

/** Suite-level configuration accepted by `describe()`. */
export interface PhoenixSuiteConfig {
  /** Override the dataset / experiment name used for the suite. */
  datasetName?: string;
  /** Description for the dataset and experiment. */
  description?: string;
  /** Suite-level metadata applied to every run in this experiment. */
  metadata?: KVMap;
  /** Override the Phoenix client used for syncing this suite. */
  client?: PhoenixClient;
  /**
   * Number of times to run each test case in this suite. Individual tests
   * may override this via `PhoenixTestParams.repetitions`. Defaults to the
   * `PHOENIX_TEST_REPETITIONS` env var, then `1`.
   */
  repetitions?: number;
  /**
   * When `true`, the whole suite runs as ordinary local tests — no dataset
   * is uploaded and no experiment, runs, or annotations are created in
   * Phoenix. Equivalent to `PHOENIX_TEST_TRACKING=false` scoped to this
   * suite. The reporter still prints a local summary.
   */
  dryRun?: boolean;
}

/** Arguments passed to a `test()` body. */
export interface PhoenixTestArgs<
  I extends KVMap = KVMap,
  E extends KVMap = KVMap,
> {
  input: I;
  expected?: E;
  metadata?: KVMap;
}

/** Phoenix annotator kind, mirrors the server enum. */
export type AnnotatorKind = "LLM" | "CODE" | "HUMAN";

/**
 * One annotation recorded against a run. Mirrors Phoenix's
 * `ExperimentEvaluationResult` plus the `name` and `annotatorKind` carried
 * on the evaluation body.
 */
export interface Annotation {
  name: string;
  score?: number | boolean | null;
  label?: string | null;
  explanation?: string | null;
  metadata?: KVMap;
  annotatorKind?: AnnotatorKind;
}

/** Result returned by `wrapEvaluator` for any evaluator-shaped value. */
export type EvaluatorResult = Annotation | (KVMap & { name: string });

/** Test handler signature. */
export type PhoenixTestFn<I extends KVMap = KVMap, E extends KVMap = KVMap> = (
  args: PhoenixTestArgs<I, E>
) => unknown | Promise<unknown>;

/** Each-row shape accepted by `test.each(table)(name, fn)`. */
export type PhoenixTestEachRow<
  I extends KVMap = KVMap,
  E extends KVMap = KVMap,
> = {
  id?: string;
  input: I;
  expected?: E;
  metadata?: KVMap;
  /** Per-row repetition count; see `PhoenixTestParams.repetitions`. */
  repetitions?: number;
  /** Per-row dry-run flag; see `PhoenixTestParams.dryRun`. */
  dryRun?: boolean;
} & Record<string, unknown>;
