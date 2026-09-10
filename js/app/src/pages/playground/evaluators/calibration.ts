import { isStringKeyedObject } from "@phoenix/typeUtils";

import type { SlotId, SlotOutput } from "./evaluatorSlotTypes";

export type CalibrationExample = {
  id: string;
  revisionId: string;
  input: unknown;
  output: unknown;
  metadata: unknown;
  calibrationLabels: ReadonlyArray<ExpectedOutput & { annotationName: string }>;
};

export type CalibrationPrediction =
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
export type CalibrationResult = CalibrationPrediction & { revision: string };

export type CalibrationRun = {
  /** The slot revision of the most recent run request. */
  revision: string;
  sampleKey: string;
  predictions: Partial<Record<string, CalibrationResult>>;
  /** Example ids awaiting a result from the current run. */
  queued: readonly string[];
  isRunning: boolean;
};

/**
 * Keep annotations out of evaluator context, even for whole-object mappings.
 * Expected outputs live in the example's annotations alongside any annotations
 * carried over from a span, and none of them should inform the judge.
 */
export function createCalibrationContext(
  example: Pick<CalibrationExample, "input" | "output" | "metadata">
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
export function getCalibrationAnnotationName({
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

/** A failed/missing prediction is not agreement. Empty comparisons have no percentage. */
export function getCalibrationAgreement({
  expected,
  predictions,
}: {
  expected: Partial<Record<string, string>>;
  predictions: Partial<Record<string, CalibrationPrediction>>;
}) {
  const reviewed = Object.entries(expected).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  );
  const matches = reviewed.filter(([id, label]) => {
    const prediction = predictions[id];
    return prediction?.status === "success" && prediction.label === label;
  }).length;
  return {
    matches,
    total: reviewed.length,
    percent: reviewed.length
      ? Math.round((matches / reviewed.length) * 100)
      : null,
  };
}

export function haveCompatibleLabels(
  left: readonly string[],
  right: readonly string[]
) {
  return (
    left.length > 0 &&
    left.length === right.length &&
    left.every((label) => right.includes(label))
  );
}

/** One request per example preserves identity despite flattened preview results. */
export async function runCalibrationSample<T>({
  items,
  concurrency = 3,
  signal,
  execute,
  onResult,
}: {
  items: readonly T[];
  concurrency?: number;
  signal: AbortSignal;
  execute: (item: T) => Promise<CalibrationPrediction>;
  onResult: (item: T, result: CalibrationPrediction) => void;
}) {
  let nextIndex = 0;
  async function worker() {
    while (!signal.aborted && nextIndex < items.length) {
      const item = items[nextIndex++];
      let result: CalibrationPrediction;
      try {
        result = await execute(item);
      } catch (error) {
        result = {
          status: "error",
          error: error instanceof Error ? error.message : "Evaluation failed",
        };
      }
      if (!signal.aborted) onResult(item, result);
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
  prediction: CalibrationPrediction | undefined,
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
  if (typeof expected.score === "number") {
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
  prediction: CalibrationPrediction | undefined;
  expected: ExpectedOutput | undefined;
  output: SlotOutput | undefined;
}): ExpectedVerdict {
  if (!expected) return null;
  if (getExpectedOutputIssue({ expected, output })) return "invalid";
  if (prediction?.status !== "success") return null;
  return matchesExpectedOutput(prediction, expected) ? "match" : "mismatch";
}
