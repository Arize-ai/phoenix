import { isStringKeyedObject } from "@phoenix/typeUtils";

export type CalibrationExample = {
  id: string;
  revisionId: string;
  input: unknown;
  output: unknown;
  metadata: unknown;
  calibrationLabels: ReadonlyArray<{ annotationName: string; label: string }>;
};

export type CalibrationPrediction =
  | {
      status: "success";
      label: string;
      explanation: string | null;
      score: number | null;
    }
  | { status: "error"; error: string };

export type CalibrationRun = {
  revision: string;
  sampleKey: string;
  predictions: Partial<Record<string, CalibrationPrediction>>;
  total: number;
  isRunning: boolean;
};

/** Keep human corrections out of evaluator context, even for whole-object mappings. */
export function createCalibrationContext(
  example: Pick<CalibrationExample, "input" | "output" | "metadata">
) {
  const metadata = isStringKeyedObject(example.metadata)
    ? { ...example.metadata }
    : {};
  delete metadata.phoenix_evaluator_calibration;
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
