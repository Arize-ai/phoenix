import type { PhoenixClient } from "../index";
import type { AnnotatorKind } from "../types/annotations";
import type {
  EvaluatorParams,
  EvaluationResult as ExperimentEvaluationResult,
} from "../types/experiments";

/**
 * Phoenix annotator kind, re-exported from the shared client types so the
 * testing module and the rest of the client agree on a single definition.
 */
export type { AnnotatorKind };

/** A JSON-serializable map. */
export type KVMap = Record<string, unknown>;

/**
 * The reference output for a test case, accepted under any one of three
 * interchangeable keys. All three normalize to the same slot: when recorded to
 * Phoenix the value becomes the dataset example's `output`, and it is exposed
 * to evaluators as `expected` on `EvaluatorParams`. At most one key may be set.
 *
 * - `expected` — the canonical name (the ground-truth / reference output).
 * - `reference` — alias preferred by frameworks that name the slot "reference".
 * - `output` — alias for callers who think in terms of the example's `output`.
 *
 * Modeled as a union so supplying more than one key at a time is a type error.
 */
export type ReferenceOutput<Expected extends KVMap = KVMap> =
  | { expected?: Expected; reference?: never; output?: never }
  | { reference?: Expected; expected?: never; output?: never }
  | { output?: Expected; expected?: never; reference?: never };

/**
 * Inline parameters common to every test case, excluding the reference output
 * (which is supplied via {@link ReferenceOutput}).
 *
 * `input` is bound to the dataset example's input field. When recorded to
 * Phoenix this becomes the example's `input`.
 */
export interface TestParamsBase<Input extends KVMap = KVMap> {
  /** Optional stable example id; used to upsert dataset examples between runs. */
  id?: string;
  /** Input for the example. Required. */
  input: Input;
  /** Additional metadata stored on the dataset example and run. */
  metadata?: KVMap;
  /**
   * Split assignment(s) for the dataset example, used to slice the dataset and
   * experiment in the Phoenix UI (e.g. `["factual_accuracy", "correct"]`).
   */
  splits?: string[];
  /** Per-test config (tags + metadata recorded on the run). */
  config?: TestConfig;
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

/**
 * Inline parameters supplied alongside a single test case.
 *
 * Combines {@link TestParamsBase} with a {@link ReferenceOutput}, so the
 * reference output may be given under `expected`, `reference`, or `output`
 * (at most one). All three resolve to the same canonical `expected` slot.
 */
export type TestParams<
  Input extends KVMap = KVMap,
  Expected extends KVMap = KVMap,
> = TestParamsBase<Input> & ReferenceOutput<Expected>;

/**
 * Resolve the canonical reference output from a value that may carry it under
 * any of the `expected` / `reference` / `output` aliases (see
 * {@link ReferenceOutput}). Returns the first one set, or `undefined` if none.
 */
export function resolveReference<Expected extends KVMap = KVMap>(
  params: ReferenceOutput<Expected>
): Expected | undefined {
  return params.expected ?? params.reference ?? params.output;
}

/** Per-test runtime configuration. */
export interface TestConfig {
  /** Tags recorded on the experiment run for filtering in the Phoenix UI. */
  tags?: string[];
  /** Extra metadata recorded on the experiment run. */
  metadata?: KVMap;
}

/** Aggregate metric used to gate an eval suite in CI. */
export type AcceptanceMetric = "average" | "passRate";

/**
 * Optimization direction for a criterion's scores: `"maximize"` (higher is
 * better, the default) or `"minimize"` (lower is better). Controls every
 * score comparison the criterion makes.
 */
export type OptimizationDirection = "maximize" | "minimize";

/** One aggregate acceptance rule for annotation scores collected in a suite. */
export interface AcceptanceCriterion {
  /** Annotation name to aggregate across completed test runs. */
  annotationName: string;
  /** Aggregate metric to compute for the annotation. */
  metric: AcceptanceMetric;
  /**
   * Score bar the criterion must clear, in the configured direction. For
   * `"average"` it is compared against the mean score across runs; for
   * `"passRate"` every run's score must clear it (the suite passes only when
   * all runs do). Boolean scores pass on `true` (or `false` when minimizing).
   */
  threshold: number;
  /** Score direction; defaults to `"maximize"`. */
  direction?: OptimizationDirection;
}

/** Computed result for one aggregate acceptance rule. */
export interface AcceptanceResult extends AcceptanceCriterion {
  /** Aggregate value (mean or pass rate), or `null` when no valid scores. */
  value: number | null;
  /** Number of numeric or boolean scores included in the aggregate. */
  sampleCount: number;
  /** Whether the aggregate cleared the criterion. */
  passed: boolean;
  /** Human-readable failure reason for invalid or empty aggregates. */
  failureReason?: string;
}

/** Suite-level configuration accepted by `describe()`. */
export interface SuiteConfig {
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
   * may override this via `TestParams.repetitions`. Defaults to the
   * `PHOENIX_TEST_REPETITIONS` env var, then `1`.
   */
  repetitions?: number;
  /**
   * When `true`, the whole suite runs as ordinary local tests — no dataset
   * is uploaded and no experiment, runs, or annotations are created in
   * Phoenix. Equivalent to `PHOENIX_TEST_TRACING=false` scoped to this
   * suite. The reporter still prints a local summary.
   */
  dryRun?: boolean;
  /**
   * Aggregate annotation criteria that gate the suite after all tests run.
   * Each criterion fails the suite when its scores miss the configured bar
   * (see {@link AcceptanceCriterion}).
   */
  acceptanceCriteria?: AcceptanceCriterion[];
}

/**
 * Arguments passed to a `test()` body. These are read straight from the
 * test's {@link TestParams} — the runner does not transform them.
 */
export interface TestArgs<
  Input extends KVMap = KVMap,
  Expected extends KVMap = KVMap,
> {
  /** The example input under test. */
  input: Input;
  /** The reference (expected) output, when one was supplied. */
  expected?: Expected;
  /** Any metadata attached to the example. */
  metadata?: KVMap;
}

/**
 * Object form of an evaluator result. Reuses the shared experiment
 * {@link ExperimentEvaluationResult} shape (label / explanation / metadata)
 * but widens `score` to also accept booleans, which the testing API stores as
 * `1` / `0`.
 */
export interface EvaluationResultObject extends Omit<
  ExperimentEvaluationResult,
  "score"
> {
  /** Numeric or boolean score; booleans are stored as `1` / `0`. */
  score?: number | boolean | null;
}

/**
 * One annotation recorded against a run. Extends the evaluator
 * {@link EvaluationResultObject} with the `name` and `annotatorKind` carried
 * on the evaluation body, plus an optional originating trace id.
 */
export interface Annotation extends EvaluationResultObject {
  /** Phoenix evaluation name. Required, and unique per run (last write wins). */
  name: string;
  /** Who or what produced the annotation. Defaults to `"CODE"`. */
  annotatorKind?: AnnotatorKind;
  /** Trace id for this evaluation, when the annotation was produced by a traced evaluator. */
  traceId?: string | null;
}

/** Result returned by `traceEvaluator` for any evaluator-shaped value. */
export type EvaluatorResult = Annotation | (KVMap & { name: string });

/** Result shape produced by evaluator objects used in eval tests. */
export type EvaluationResult =
  | number
  | boolean
  | string
  | null
  | EvaluationResultObject;

/**
 * Parameters passed to an evaluator when it runs inside a test. A relaxation of
 * the shared {@link EvaluatorParams}: `input` is always present, while `output`
 * (an evaluator may run before `logOutput()`) and the remaining fields are
 * optional. Deriving from `EvaluatorParams` keeps this aligned with the
 * experiment evaluator contract as that shape evolves.
 */
export type EvaluationParams = Partial<EvaluatorParams> & {
  /** The example input under test. */
  input: KVMap;
};

/** Structural evaluator interface accepted by `evaluate()`. */
export interface Evaluator<
  Params extends KVMap = EvaluationParams & KVMap,
  Result = EvaluationResult,
> {
  /** Annotation/evaluation name. */
  name: string;
  /** Who or what produced the result. Defaults to `"CODE"`. */
  kind?: AnnotatorKind;
  /** Compute the evaluation result. */
  evaluate: (params: Params) => Result | Promise<Result>;
}

/** Test handler signature. */
export type TestFn<
  Input extends KVMap = KVMap,
  Expected extends KVMap = KVMap,
> = (args: TestArgs<Input, Expected>) => unknown | Promise<unknown>;

/**
 * Each-row shape accepted by `test.each(table)(name, fn)`.
 *
 * Like {@link TestParams}, the reference output is supplied via
 * {@link ReferenceOutput} (`expected` / `reference` / `output`, at most one).
 * The trailing index signature still permits arbitrary extra columns on a row
 * (e.g. for `%j` name interpolation) without weakening that constraint.
 */
export type TestEachRow<
  Input extends KVMap = KVMap,
  Expected extends KVMap = KVMap,
> = {
  id?: string;
  input: Input;
  metadata?: KVMap;
  /** Per-row split assignment(s); see `TestParams.splits`. */
  splits?: string[];
  /** Per-row repetition count; see `TestParams.repetitions`. */
  repetitions?: number;
  /** Per-row dry-run flag; see `TestParams.dryRun`. */
  dryRun?: boolean;
} & ReferenceOutput<Expected> &
  Record<string, unknown>;
