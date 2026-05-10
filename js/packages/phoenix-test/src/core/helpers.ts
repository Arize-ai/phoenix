import { postAnnotation, runEvaluatorWithTracing } from "./phoenix";
import { currentRun, type SuiteState } from "./state";
import type { Annotation, KVMap } from "./types";

/**
 * Record the actual output produced by the test for the current run.
 *
 * Calling this multiple times overwrites the previously logged value.
 * The argument can be any JSON-serializable value — typically an object
 * matching the shape of the example's `expected` field.
 */
export function logOutput(output: unknown): void {
  const run = currentRun();
  if (!run) {
    throw new Error(
      "logOutput() must be called inside a phoenix-test test body"
    );
  }
  run.output = output;
  run.outputSet = true;
}

/**
 * Record an annotation on the current run.
 *
 * Annotations are collected during the test and posted to Phoenix as
 * experiment evaluations after the test completes. The `name` is the
 * Phoenix evaluation name; `score`, `label`, and `explanation` map to
 * the standard Phoenix `EvaluationResult` fields.
 *
 * The annotation name `"pass"` is reserved — phoenix-test always writes
 * a `pass` annotation derived from the test's assertion outcome, so a
 * user-supplied annotation with that name would race / overwrite the
 * built-in one. Such calls are silently ignored.
 */
export function logAnnotation(annotation: Annotation): void {
  const run = currentRun();
  if (!run) {
    throw new Error(
      "logAnnotation() must be called inside a phoenix-test test body"
    );
  }
  if (annotation.name === "pass") return;
  run.annotations.push(annotation);
}

/**
 * Wrap an evaluator function so its execution shows up as a separate
 * `EVALUATOR` span in Phoenix and any `{ name, score }`-shaped return
 * value is automatically captured as an annotation on the current run.
 *
 * The annotation name defaults to the wrapped function's name, falling
 * back to `"evaluator"`.
 */
export function wrapEvaluator<P extends KVMap, R>(
  fn: (params: P) => R | Promise<R>,
  options?: { name?: string }
): (params: P) => Promise<R> {
  const evaluatorName =
    options?.name ?? (fn.name && fn.name !== "" ? fn.name : "evaluator");
  return async (params: P) => {
    const run = currentRun();
    if (!run) {
      // outside a test context, just call the function plainly
      return await fn(params);
    }
    const result = await runEvaluatorWithTracing(
      run.suite,
      evaluatorName,
      params,
      fn
    );
    if (isAnnotationShaped(result)) {
      logAnnotation(result);
    }
    return result;
  };
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
 * wins) and post serially so the final state is deterministic.
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
  for (const annotation of byName.values()) {
    await postAnnotation(suite, runId, annotation);
  }
}
