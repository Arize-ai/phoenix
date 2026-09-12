import { isStringKeyedObject } from "@phoenix/typeUtils";

import type { SlotId, SlotOutput } from "./evaluatorSlotTypes";

/**
 * One row of the sample: a dataset example, or a span read through its
 * evaluation context so it carries the same `{input, output, metadata}` shape.
 * For a span, `id` and `revisionId` are both the span id.
 */
export type SampleExample = {
  id: string;
  revisionId: string;
  /** A display name where the row has one (a span's name). */
  name?: string;
  input: unknown;
  output: unknown;
  metadata: unknown;
  calibrationLabels: ReadonlyArray<SampleExpectedOutput>;
};

/**
 * A persisted expected output. On a span it is a HUMAN span annotation, and
 * `annotationId` is what a later change or clear addresses.
 */
export type SampleExpectedOutput = ExpectedOutput & {
  annotationName: string;
  annotationId?: string;
};

export type EvaluatorPrediction =
  | {
      status: "success";
      label: string | null;
      explanation: string | null;
      score: number | null;
    }
  | { status: "error"; error: string };

/** A prediction plus the slot revision that produced it, so a cell can tell
 * whether its result still describes the evaluator as currently drafted. Rows
 * can be run one at a time, so this is per result rather than per run. */
export type EvaluatorResult = EvaluatorPrediction & { revision: string };

export type EvaluatorRun = {
  /** The slot revision of the most recent run request. */
  revision: string;
  sampleKey: string;
  predictions: Partial<Record<string, EvaluatorResult>>;
  /** Example ids awaiting a result from the current run. */
  queued: readonly string[];
  isRunning: boolean;
};

/**
 * Keep annotations out of evaluator context, even for whole-object mappings.
 * Expected outputs live in the example's annotations alongside any annotations
 * carried over from a span, and none of them should inform the judge.
 *
 * Span rows are stripped the same way. An online project evaluator does see a
 * span's prior annotations, but the playground deliberately hides the expected
 * labels it writes there, so the mapping source and the run context both drop
 * `metadata.annotations`; the rest of a span's metadata (`attributes` included)
 * is kept.
 */
export function createEvaluatorContext(
  example: Pick<SampleExample, "input" | "output" | "metadata">
) {
  const metadata = isStringKeyedObject(example.metadata)
    ? { ...example.metadata }
    : {};

  delete metadata.annotations;

  return {
    input: example.input,
    output: example.output,
    reference: {},
    metadata,
  };
}

/** Single-output evaluators name annotations after the evaluator; multi-output
 * evaluators prefix the configured output name with the evaluator name. */
export function getEvaluatorAnnotationName({
  evaluatorName,
  outputName,
  outputCount,
}: {
  evaluatorName: string;
  outputName: string;
  outputCount: number;
}) {
  return outputCount > 1 ? `${evaluatorName}.${outputName}` : evaluatorName;
}

/**
 * One request per example preserves identity despite flattened preview results.
 * Aborting `signal` stops scheduling; results that land afterwards are dropped.
 */
export async function runEvaluatorSample<T>({
  items,
  concurrency = 3,
  signal,
  execute,
  onResult,
}: {
  items: readonly T[];
  concurrency?: number;
  signal?: AbortSignal;
  execute: (item: T) => Promise<EvaluatorPrediction>;
  onResult: (item: T, result: EvaluatorPrediction) => void;
}) {
  let nextIndex = 0;

  async function worker() {
    while (!signal?.aborted && nextIndex < items.length) {
      const item = items[nextIndex++];
      let result: EvaluatorPrediction;

      try {
        result = await execute(item);
      } catch (error) {
        result = {
          status: "error",
          error: error instanceof Error ? error.message : "Evaluation failed",
        };
      }

      if (!signal?.aborted) onResult(item, result);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      worker
    )
  );
}

export type ExpectedOutput = {
  label: string | null;
  score?: number | null;
  explanation?: string | null;
};

export type SlotExpectations = Partial<
  Record<SlotId, Partial<Record<string, ExpectedOutput>>>
>;

export function matchesExpectedOutput(
  prediction: EvaluatorPrediction | undefined,
  expected: ExpectedOutput
) {
  return (
    prediction?.status === "success" &&
    (expected.label == null || prediction.label === expected.label) &&
    (expected.score == null || prediction.score === expected.score)
  );
}

/**
 * Why an expected output can no longer be produced by the slot's selected
 * output, or null when it still can. This replaces content hashing: the only
 * way an expectation goes stale is the output config moving out from under it,
 * and that is checked directly.
 */
export function getExpectedOutputIssue({
  expected,
  output,
}: {
  expected: ExpectedOutput;
  output: SlotOutput | undefined;
}): string | null {
  if (!output) return null;

  if (
    expected.label != null &&
    output.labels.length > 0 &&
    !output.labels.includes(expected.label)
  )
    return `"${expected.label}" is not one of this output's labels.`;

  if (expected.score != null) {
    if (output.lowerBound != null && expected.score < output.lowerBound)
      return `Score ${expected.score} is below the output's minimum of ${output.lowerBound}.`;

    if (output.upperBound != null && expected.score > output.upperBound)
      return `Score ${expected.score} is above the output's maximum of ${output.upperBound}.`;
  }

  return null;
}

export type ExpectedVerdict = "match" | "mismatch" | "invalid" | null;

/**
 * How an expected output stands against the slot: invalid when the output
 * config can no longer produce it, otherwise compared with the prediction when
 * there is one. Agreement is only ever counted over valid expectations.
 */
export function getExpectedVerdict({
  prediction,
  expected,
  output,
}: {
  prediction: EvaluatorPrediction | undefined;
  expected: ExpectedOutput | undefined;
  output: SlotOutput | undefined;
}): ExpectedVerdict {
  if (!expected) return null;

  if (getExpectedOutputIssue({ expected, output })) return "invalid";

  if (prediction?.status !== "success") return null;

  return matchesExpectedOutput(prediction, expected) ? "match" : "mismatch";
}
