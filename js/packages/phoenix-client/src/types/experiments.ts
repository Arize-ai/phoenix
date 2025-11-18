import type { ClassificationEvaluator } from "@arizeai/phoenix-evals";

import { AnnotatorKind } from "./annotations";
import { Node } from "./core";
import { Example, ExampleWithId } from "./datasets";

/**
 * An experiment is a set of task runs on a dataset version
 */
export interface ExperimentInfo extends Node {
  datasetId: string;
  datasetVersionId: string;
  // @todo: mark this as required when experiment API returns it
  datasetSplits?: string[];
  /**
   * Number of times the experiment is repeated
   */
  repetitions: number;
  /**
   * Metadata about the experiment as an object of key values
   * e.x. model name
   */
  metadata: Record<string, unknown>;
  /**
   * The project under which the experiment task traces are recorded
   * Note: This can be null when no project is associated with the experiment
   */
  projectName: string | null;
  /**
   * The creation timestamp of the experiment
   */
  createdAt: string;
  /**
   * The last update timestamp of the experiment
   */
  updatedAt: string;
  /**
   * Number of examples in the experiment
   */
  exampleCount: number;
  /**
   * Number of successful runs in the experiment
   */
  successfulRunCount: number;
  /**
   * Number of failed runs in the experiment
   */
  failedRunCount: number;
  /**
   * Number of missing (not yet executed) runs in the experiment
   */
  missingRunCount: number;
}

export type ExperimentRunID = string;

/**
 * Represents incomplete experiment runs for a dataset example
 * Groups all incomplete repetitions for a single example
 */
export interface IncompleteRun {
  /**
   * The dataset example that has incomplete runs
   */
  datasetExample: Example;
  /**
   * List of repetition numbers that need to be run for this example
   */
  repetitionNumbers: number[];
}

export interface IncompleteEvaluation {
  /**
   * The experiment run with incomplete evaluations
   */
  experimentRun: ExperimentRun;
  /**
   * The dataset example for this run
   */
  datasetExample: ExampleWithId;
  /**
   * List of evaluation names that are incomplete (either missing or failed)
   */
  evaluationNames: string[];
}

/**
 * A map of an experiment runId to the run
 */
export interface ExperimentRunsMap {
  runs: Record<ExperimentRunID, ExperimentRun>;
}

/**
 * An experiment that has been run and been recorded on the server
 */
export interface RanExperiment extends ExperimentInfo, ExperimentRunsMap {
  evaluationRuns?: ExperimentEvaluationRun[];
}

/**
 * The result of running an experiment on a single example
 */
export interface ExperimentRun extends Node {
  startTime: Date;
  endTime: Date;
  /**
   * What experiment the run belongs to
   */
  experimentId: string;
  datasetExampleId: string;
  output?: string | boolean | number | object | null;
  error: string | null;
  traceId: string | null;
}

export type EvaluatorParams<TaskOutputType = TaskOutput> = {
  /**
   * The input field of the Dataset Example
   */
  input: Example["input"];
  /**
   * The output of the task
   */
  output: TaskOutputType;
  /**
   * The expected or reference output of the Dataset Example
   */
  expected?: Example["output"];
  /**
   * Metadata associated with the Dataset Example
   */
  metadata?: Example["metadata"];
};

export type Evaluator = {
  name: string;
  kind: AnnotatorKind;
  evaluate: (
    args: EvaluatorParams
  ) => Promise<EvaluationResult> | EvaluationResult;
};

export type EvaluationResult = {
  score?: number | null;
  label?: string | null;
  metadata?: Record<string, unknown>;
  explanation?: string | null;
};

export interface ExperimentEvaluationRun extends Node {
  experimentRunId: string;
  startTime: Date;
  endTime: Date;
  /**
   * THe name of the evaluation
   */
  name: string;
  annotatorKind: AnnotatorKind;
  error: string | null;
  result: EvaluationResult | null;
  /**
   * The trace id of the evaluation
   * This is null if the trace is deleted or never recorded
   */
  traceId: string | null;
}

export type TaskOutput = string | boolean | number | object | null;

export type ExperimentTask = (
  example: Example
) => Promise<TaskOutput> | TaskOutput;

export interface ExperimentParameters {
  /**
   * The number of examples to run the experiment on
   */
  nExamples: number;
}

/**
 * A type that represents any type of evaluator that can be used in an experiment.
 * Unknown is used to capture evaluators from an external library such as phoenix-evals.
 */
export type ExperimentEvaluatorLike =
  | Evaluator
  | ClassificationEvaluator<Record<string, unknown>>;
