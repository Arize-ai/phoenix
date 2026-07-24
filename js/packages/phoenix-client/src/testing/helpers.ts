import {
  endTaskSpanForRun,
  postAnnotation,
  runEvaluatorWithTracing,
} from "./phoenix-test-tracking";
import { currentRun, type SuiteState } from "./state";
import type {
  Annotation,
  EvaluationParams,
  EvaluationResult,
  EvaluationResultObject,
  Evaluator,
  KVMap,
} from "./types";

/**
 * Log the output produced by the test for the current run.
 *
 * Calling this multiple times overwrites the previously recorded value.
 * The argument can be any JSON-serializable value — typically an object
 * matching the shape of the example's `expected` field.
 */
export function logOutput(output: unknown): void {
  const run = currentRun();
  if (!run) {
    throw new Error(
      "logOutput() must be called inside a Phoenix eval test body"
    );
  }
  run.output = output;
  run.outputSet = true;
  endTaskSpanForRun(run);
}

/**
 * Record an annotation on the current run.
 *
 * Annotations are collected during the test and posted to Phoenix as
 * experiment evaluations after the test completes. The `name` is the
 * Phoenix evaluation name; `score`, `label`, and `explanation` map to
 * the standard Phoenix `EvaluationResult` fields.
 *
 * The annotation name `"pass"` is reserved — Phoenix eval tests always write
 * a `pass` annotation derived from the test's assertion outcome, so a
 * user-supplied annotation with that name would race / overwrite the
 * built-in one. Such calls are silently ignored.
 */
export function logAnnotation(annotation: Annotation): void {
  const run = currentRun();
  if (!run) {
    throw new Error(
      "logAnnotation() must be called inside a Phoenix eval test body"
    );
  }
  if (annotation.name === "pass") return;
  run.annotations.push(annotation);
}

/**
 * Run an evaluator object against the current test run and record the result.
 *
 * The evaluator may come from `@arizeai/phoenix-evals.createEvaluator`,
 * `asExperimentEvaluator`, or any plain object with `{ name, evaluate }`.
 * When `params` is omitted, the current test's `input`, recorded `output`,
 * `expected`, `metadata`, and task `traceId` are supplied.
 */
export async function evaluate<
  Params extends KVMap = EvaluationParams & KVMap,
  Result = EvaluationResult,
>(
  evaluator: Evaluator<Params, Result>,
  params?: Partial<Params> & KVMap
): Promise<Result> {
  const run = currentRun();
  if (!run) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- caller-supplied params default; generic Params cannot be constructed here
    return await evaluator.evaluate((params ?? {}) as Params);
  }

  if (!run.outputSet && !(params && "output" in params)) {
    warnEvaluateBeforeOutput(run.suite, evaluator.name, run.testName);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- assembled default params; generic Params cannot be constructed here
  const evaluatorParams = {
    input: run.params.input,
    // `run.output` is only ever set together with `outputSet`, so it is already
    // `undefined` until a value is recorded.
    output: run.output,
    expected: run.params.expected,
    metadata: run.params.metadata,
    traceId: run.traceId ?? null,
    ...(params ?? {}),
  } as unknown as Params;

  const { result, traceId } = await runEvaluatorWithTracing(
    run.suite,
    evaluator.name,
    evaluatorParams,
    (paramsToEvaluate) => evaluator.evaluate(paramsToEvaluate)
  );
  logAnnotation(
    toAnnotation({
      name: evaluator.name,
      kind: evaluator.kind,
      result,
      traceId,
    })
  );
  return result;
}

/**
 * Trace an evaluator function so its execution shows up as a separate
 * `EVALUATOR` span in Phoenix and any `{ name, score }`-shaped return
 * value is automatically captured as an annotation on the current run.
 *
 * The annotation name defaults to the traced function's name, falling
 * back to `"evaluator"`.
 */
export function traceEvaluator<EvaluatorParams extends KVMap, EvaluatorResult>(
  fn: (params: EvaluatorParams) => EvaluatorResult | Promise<EvaluatorResult>,
  options?: { name?: string }
): (params: EvaluatorParams) => Promise<EvaluatorResult> {
  const evaluatorName =
    options?.name ?? (fn.name && fn.name !== "" ? fn.name : "evaluator");
  return async (params: EvaluatorParams) => {
    const run = currentRun();
    if (!run) {
      // outside a test context, just call the function plainly
      return await fn(params);
    }
    const { result, traceId } = await runEvaluatorWithTracing(
      run.suite,
      evaluatorName,
      params,
      fn
    );
    if (isAnnotationShaped(result)) {
      logAnnotation({ ...result, traceId });
    }
    return result;
  };
}

/**
 * Warn (at most once per suite) when an evaluator runs before any output was
 * recorded and none was passed explicitly. Such an evaluator receives
 * `output: undefined`, which silently scores against nothing — almost always a
 * forgotten `logOutput()`. Harmless for evaluators that only read `input`.
 */
const warnedOutputSuites = new WeakSet<SuiteState>();
function warnEvaluateBeforeOutput(
  suite: SuiteState,
  evaluatorName: string,
  testName: string
): void {
  if (warnedOutputSuites.has(suite)) return;
  warnedOutputSuites.add(suite);
  // eslint-disable-next-line no-console
  console.warn(
    `[@arizeai/phoenix-client] evaluate("${evaluatorName}") ran before ` +
      `logOutput() on test "${testName}", so the evaluator received ` +
      `output=undefined. Call logOutput(...) first, or pass { output } ` +
      `explicitly. (Ignore if this evaluator only needs input.)`
  );
}

/**
 * Normalize an evaluator's return value into an {@link Annotation}. The value
 * is already typed as an {@link EvaluationResult}, so we only dispatch on its
 * runtime shape: a string becomes a `label`, a number/boolean/null becomes a
 * `score`, and an object contributes its `score`/`label`/`explanation`/
 * `metadata` directly.
 */
function toAnnotation({
  name,
  kind,
  result,
  traceId,
}: {
  name: string;
  kind?: Annotation["annotatorKind"];
  result: unknown;
  traceId?: string | null;
}): Annotation {
  const annotatorKind = kind ?? "CODE";
  if (typeof result === "string") {
    return { name, label: result, annotatorKind, traceId };
  }
  if (
    typeof result === "number" ||
    typeof result === "boolean" ||
    result === null
  ) {
    return { name, score: result, annotatorKind, traceId };
  }
  if (typeof result === "object" && !Array.isArray(result)) {
    const { score, label, explanation, metadata } =
      result as EvaluationResultObject;
    return {
      name,
      score,
      label,
      explanation,
      metadata,
      annotatorKind,
      traceId,
    };
  }
  return { name, annotatorKind, traceId };
}

function isAnnotationShaped(value: unknown): value is Annotation {
  if (!value || typeof value !== "object") return false;
  const v = value as { name?: unknown; score?: unknown };
  if (typeof v.name !== "string") return false;
  if (
    v.score !== undefined &&
    typeof v.score !== "number" &&
    typeof v.score !== "boolean" &&
    v.score !== null
  ) {
    return false;
  }
  return true;
}

/**
 * Internal: persist all collected annotations for the run.
 *
 * Phoenix's `experiment_evaluations` endpoint is keyed by
 * `(experiment_run_id, name)` so two annotations with the same name on
 * the same run race each other. We collapse duplicates by name (last
 * wins) up front, which makes the final state deterministic; the
 * remaining writes target distinct names, so they post in parallel.
 */
export async function flushAnnotations(
  runId: string | undefined,
  annotations: Annotation[],
  suite: SuiteState
): Promise<void> {
  if (!annotations.length) return;
  const byName = new Map<string, Annotation>();
  for (const annotation of annotations) {
    byName.set(annotation.name, annotation);
  }
  await Promise.all(
    Array.from(byName.values(), (annotation) =>
      postAnnotation(suite, runId, annotation)
    )
  );
}
