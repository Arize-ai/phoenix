import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type { EvaluatorMappingSource } from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/** A dataset example's revision, as the evaluator context is built from it. */
export type EvaluatorContextExample = {
  input: unknown;
  output: unknown;
  metadata: unknown;
};

export type EvaluatorPrediction =
  | {
      status: "success";
      label: string | null;
      explanation: string | null;
      score: number | null;
    }
  | { status: "error"; error: string };

/**
 * Keep annotations out of evaluator context, even for whole-object mappings.
 * Expected outputs live in the example's annotations alongside any annotations
 * carried over from a span, and none of them should inform the judge.
 */
export function createEvaluatorContext(example: EvaluatorContextExample) {
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

/**
 * The evaluator context of an example as the mapping editor's sample, at
 * dataset grain. A primitive field is wrapped so it still offers a path to
 * map a variable to.
 */
export function createEvaluatorMappingSource(
  example: EvaluatorContextExample
): EvaluatorMappingSource<"dataset"> {
  const context = createEvaluatorContext(example);

  return {
    input: asMappingRecord(context.input),
    output: asMappingRecord(context.output),
    reference: context.reference,
    metadata: context.metadata,
  };
}

function asMappingRecord(value: unknown): Record<string, unknown> {
  return isStringKeyedObject(value) ? value : { value };
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

export type ExpectedOutput = {
  label: string | null;
  score?: number | null;
  explanation?: string | null;
};

/**
 * One output of an evaluator, reduced to what a results cell needs to render
 * and validate an expected output against it: the allowed labels and their
 * configured scores for a categorical output, the bounds for a numeric one.
 */
export type EvaluatorOutput = {
  name: string;
  labels: string[];
  labelScores: Partial<Record<string, number>>;
  lowerBound: number | null;
  upperBound: number | null;
};

export function toEvaluatorOutput(config: AnnotationConfig): EvaluatorOutput {
  if ("values" in config) {
    return {
      name: config.name,
      labels: config.values.map((value) => value.label),
      labelScores: Object.fromEntries(
        config.values.flatMap((value) =>
          value.score != null ? [[value.label, value.score]] : []
        )
      ),
      lowerBound: null,
      upperBound: null,
    };
  }

  return {
    name: config.name,
    labels: [],
    labelScores: {},
    lowerBound: config.lowerBound ?? null,
    upperBound: config.upperBound ?? null,
  };
}

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
 * Why an expected output can no longer be produced by the evaluator's output,
 * or null when it still can. This replaces content hashing: the only way an
 * expectation goes stale is the output config moving out from under it, and
 * that is checked directly.
 */
export function getExpectedOutputIssue({
  expected,
  output,
}: {
  expected: ExpectedOutput;
  output: EvaluatorOutput | undefined;
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
 * How an expected output stands against the evaluator: invalid when the
 * output config can no longer produce it, otherwise compared with the
 * prediction when there is one. Agreement is only ever counted over valid
 * expectations.
 */
export function getExpectedVerdict({
  prediction,
  expected,
  output,
}: {
  prediction: EvaluatorPrediction | undefined;
  expected: ExpectedOutput | undefined;
  output: EvaluatorOutput | undefined;
}): ExpectedVerdict {
  if (!expected) return null;

  if (getExpectedOutputIssue({ expected, output })) return "invalid";

  if (prediction?.status !== "success") return null;

  return matchesExpectedOutput(prediction, expected) ? "match" : "mismatch";
}
