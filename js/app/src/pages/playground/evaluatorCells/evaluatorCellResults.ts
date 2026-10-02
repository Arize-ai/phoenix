import type { AnnotationConfig } from "@phoenix/components/annotation";
import type { PlaygroundEvaluatorTask } from "@phoenix/store/playground";

import type {
  EvaluatorOutput,
  EvaluatorPrediction,
  ExpectedOutput,
} from "../evaluators/evaluatorResults";
import {
  getEvaluatorAnnotationName,
  getExpectedVerdict,
  toEvaluatorOutput,
} from "../evaluators/evaluatorResults";
import { getEvaluatorTaskName } from "../evaluators/evaluatorTaskSnapshot";
import type { PendingExpectedOutputs } from "../evaluators/expectedOutputQueue";
import type {
  ExampleRunData,
  InstanceResponses,
} from "../PlaygroundDatasetExamplesTableContext";

/** A dataset example's stored expected outputs, as the table's rows carry them. */
export type ExpectedOutputExample = {
  id: string;
  expectedOutputs: ReadonlyArray<{
    annotationName: string;
    label: string | null;
    score: number | null;
    explanation: string | null;
  }>;
};

/** One example's stored expected outputs, as the dataset lists them. */
export type StoredExpectedOutputs = {
  exampleId: string;
  expectedOutputs: ExpectedOutputExample["expectedOutputs"];
};

/**
 * Every example's expected outputs: the dataset's, read for all examples at
 * once, with each loaded row's revision in its place. Writes land on the
 * loaded rows, so those are the freshest copy.
 */
export function mergeExpectedOutputExamples({
  stored,
  loaded,
}: {
  stored: ReadonlyArray<StoredExpectedOutputs>;
  loaded: ReadonlyArray<ExpectedOutputExample>;
}): ExpectedOutputExample[] {
  const byExampleId = new Map<string, ExpectedOutputExample["expectedOutputs"]>(
    stored.map((example) => [example.exampleId, example.expectedOutputs])
  );

  for (const example of loaded) {
    byExampleId.set(example.id, example.expectedOutputs);
  }

  return Array.from(byExampleId, ([id, expectedOutputs]) => ({
    id,
    expectedOutputs,
  }));
}

export type EvaluatorTaskAnnotation = {
  /** The annotation name the task's runs write, and expected outputs use. */
  name: string;
  /** The reviewed output's config, renamed to the annotation it writes. */
  config: AnnotationConfig | undefined;
  /** The reviewed output's labels and bounds; undefined without an output. */
  output: EvaluatorOutput | undefined;
};

/**
 * The annotation the table reviews for an evaluator task: the one its first
 * configured output produces. Evaluators with several outputs are rare, and
 * their other outputs still show in the experiment's compare table.
 */
export function getEvaluatorTaskAnnotation({
  evaluator,
  position,
}: {
  evaluator: Pick<PlaygroundEvaluatorTask, "name" | "outputConfigs">;
  position: number;
}): EvaluatorTaskAnnotation {
  const evaluatorName = getEvaluatorTaskName(evaluator, position);
  const config = evaluator.outputConfigs[0];

  if (!config) {
    return { name: evaluatorName, config: undefined, output: undefined };
  }

  const name = getEvaluatorAnnotationName({
    evaluatorName,
    outputName: config.name,
    outputCount: evaluator.outputConfigs.length,
  });

  return {
    name,
    config: toAnnotationConfig({ config, name }),
    output: toEvaluatorOutput(config),
  };
}

/**
 * An evaluator task's output config in the shape the annotation components
 * take, under the annotation name its runs write. Numeric outputs keep their
 * bounds whether or not they are declared continuous.
 */
function toAnnotationConfig({
  config,
  name,
}: {
  config: PlaygroundEvaluatorTask["outputConfigs"][number];
  name: string;
}): AnnotationConfig {
  if ("values" in config) {
    return {
      name,
      annotationType: "CATEGORICAL",
      optimizationDirection: config.optimizationDirection,
      values: config.values.map((value) => ({
        label: value.label,
        score: value.score ?? null,
      })),
    };
  }

  return {
    name,
    annotationType: "CONTINUOUS",
    optimizationDirection: config.optimizationDirection,
    lowerBound: config.lowerBound ?? null,
    upperBound: config.upperBound ?? null,
  };
}

export type EvaluatorCellResult = {
  prediction: EvaluatorPrediction;
  trace: { traceId: string; projectId: string } | null;
};

/**
 * The evaluator's verdict on one run, read off the evaluation chunk its
 * experiment emitted. The chunk named after the task's annotation is
 * preferred; a task renamed since the run falls back to whatever the run
 * produced. A run that failed before judging shows the run's error.
 */
export function getEvaluatorCellResult({
  runData,
  annotationName,
}: {
  runData: ExampleRunData | undefined;
  annotationName: string;
}): EvaluatorCellResult | null {
  const evaluations = runData?.evaluations ?? [];

  const chunk =
    evaluations.find(
      (evaluation) => evaluation.evaluatorName === annotationName
    ) ?? evaluations[0];

  const trace = chunk?.trace
    ? { traceId: chunk.trace.traceId, projectId: chunk.trace.projectId }
    : null;

  if (chunk?.error != null) {
    return { prediction: { status: "error", error: chunk.error }, trace };
  }

  if (chunk?.experimentRunEvaluation) {
    const { label, score, explanation } = chunk.experimentRunEvaluation;

    return {
      prediction: {
        status: "success",
        label: label ?? null,
        score: score ?? null,
        explanation: explanation ?? null,
      },
      trace,
    };
  }

  if (runData?.errorMessage != null) {
    return {
      prediction: { status: "error", error: runData.errorMessage },
      trace: null,
    };
  }

  return null;
}

/**
 * The expected output to show for an example: an annotation still in the
 * write queue wins over what the dataset has (a queued `null` is a clear),
 * so a thumbs press reads back at once.
 */
export function getExpectedOutput({
  pending,
  expectedOutputs,
  annotationName,
}: {
  pending: PendingExpectedOutputs[string] | undefined;
  expectedOutputs: ExpectedOutputExample["expectedOutputs"];
  annotationName: string;
}): ExpectedOutput | undefined {
  if (pending && annotationName in pending) {
    return pending[annotationName] ?? undefined;
  }

  const stored = expectedOutputs.find(
    (expectedOutput) => expectedOutput.annotationName === annotationName
  );

  return stored
    ? {
        label: stored.label,
        score: stored.score,
        explanation: stored.explanation,
      }
    : undefined;
}

export type ExpectedAgreement = {
  /** Examples with an expected output recorded. */
  withExpected: number;
  /** Of those, the ones the output config can still produce. */
  comparable: number;
  /** Of those, the ones the evaluator's verdict matched. */
  matches: number;
};

/**
 * How the evaluator stands against the expected outputs of `examples`,
 * counted over the first repetition. Agreement is counted over
 * expectations the output config can still produce, so "2/2 agree" cannot be
 * mistaken for a share of the whole sample.
 */
export function summarizeExpectedAgreement({
  examples,
  responses,
  pendingExpectedOutputs,
  annotationName,
  output,
}: {
  examples: ReadonlyArray<ExpectedOutputExample>;
  responses: InstanceResponses | undefined;
  pendingExpectedOutputs: PendingExpectedOutputs;
  annotationName: string;
  output: EvaluatorOutput | undefined;
}): ExpectedAgreement {
  const agreement: ExpectedAgreement = {
    withExpected: 0,
    comparable: 0,
    matches: 0,
  };

  for (const example of examples) {
    const expected = getExpectedOutput({
      pending: pendingExpectedOutputs[example.id],
      expectedOutputs: example.expectedOutputs,
      annotationName,
    });

    if (!expected) {
      continue;
    }

    agreement.withExpected += 1;

    const verdict = getExpectedVerdict({
      prediction: getEvaluatorCellResult({
        runData: responses?.[example.id]?.[1],
        annotationName,
      })?.prediction,
      expected,
      output,
    });

    if (verdict === "invalid") {
      continue;
    }

    agreement.comparable += 1;

    if (verdict === "match") {
      agreement.matches += 1;
    }
  }

  return agreement;
}
