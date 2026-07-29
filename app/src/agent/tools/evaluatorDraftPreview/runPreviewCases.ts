import type {
  EvaluatorPreviewBatchOutput,
  EvaluatorPreviewCase,
  EvaluatorPreviewCaseResult,
  EvaluatorPreviewRunner,
} from "./types";

const DEFAULT_GET_NOW = () => Date.now();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getEvaluatorPreviewError(output: unknown): string | null {
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return null;
  }
  const results = (output as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return null;
  }
  const errors = results.flatMap((result) => {
    if (typeof result !== "object" || result === null) return [];
    const error = (result as { error?: unknown }).error;
    return typeof error === "string" && error.length > 0 ? [error] : [];
  });
  return errors.length > 0 ? errors.join("\n") : null;
}

async function runPreviewCase({
  previewCase,
  runPreview,
  getNow,
}: {
  previewCase: EvaluatorPreviewCase;
  runPreview: EvaluatorPreviewRunner;
  getNow: () => number;
}): Promise<EvaluatorPreviewCaseResult> {
  const startedAt = getNow();
  try {
    const preview = await runPreview(previewCase.testPayload);
    const latencyMs = Math.max(0, getNow() - startedAt);
    if (!preview.ok) {
      return { id: previewCase.id, error: preview.error, latencyMs };
    }
    const evaluatorError = getEvaluatorPreviewError(preview.output);
    // Keep `result` attached even when an evaluator-level error is present:
    // a case can have multiple output configs, and one erroring must not
    // discard the successful annotations for the others.
    return evaluatorError
      ? {
          id: previewCase.id,
          error: evaluatorError,
          latencyMs,
          result: preview.output,
        }
      : { id: previewCase.id, result: preview.output, latencyMs };
  } catch (error) {
    return {
      id: previewCase.id,
      error: getErrorMessage(error),
      latencyMs: Math.max(0, getNow() - startedAt),
    };
  }
}

/** Runs named preview cases with bounded concurrency while preserving input order. */
export async function runEvaluatorPreviewCases({
  cases,
  runPreview,
  concurrency,
  getNow = DEFAULT_GET_NOW,
}: {
  cases: EvaluatorPreviewCase[];
  runPreview: EvaluatorPreviewRunner;
  concurrency: number;
  getNow?: () => number;
}): Promise<EvaluatorPreviewBatchOutput> {
  const boundedConcurrency = Math.max(1, Math.floor(concurrency));
  const orderedResults: EvaluatorPreviewCaseResult[] = new Array(cases.length);
  // A bounded worker pool, not fixed-size sequential waves: each worker pulls
  // the next case as soon as it frees up, so one slow case doesn't stall an
  // otherwise-idle concurrency slot until its whole wave finishes.
  let nextIndex = 0;
  async function runWorker(): Promise<void> {
    while (nextIndex < cases.length) {
      const index = nextIndex;
      nextIndex += 1;
      orderedResults[index] = await runPreviewCase({
        previewCase: cases[index],
        runPreview,
        getNow,
      });
    }
  }
  const workerCount = Math.min(boundedConcurrency, cases.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  const failed = orderedResults.filter((result) => "error" in result).length;
  return {
    summary: {
      total: orderedResults.length,
      succeeded: orderedResults.length - failed,
      failed,
    },
    cases: orderedResults,
  };
}
