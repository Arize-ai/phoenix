import { AnnotatorKind } from "./annotations";
import { Node } from "./core";
import { Example } from "./datasets";

/**
 * An experiment is a set of task runs on a dataset version
 */
export interface ExperimentInfo extends Node {
  datasetId: string;
  datasetVersionId: string;
  /**
   * The project under which the experiment task traces are recorded
   */
  projectName: string;
  /**
   * Metadata about the experiment as an object of key values
   * e.x. model name
   */
  metadata: Record<string, unknown>;
}

export type ExperimentRunID = string;

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

export type EvaluatorParams = {
  /**
   * The input field of the Dataset Example
   */
  input: Example["input"];
  /**
   * The output of the task
   */
  output: TaskOutput;
  /**
   * The expected or reference output of the Dataset Example
   */
  expected?: Example["output"];
  /**
   * Metadata associated with the Dataset Example
   */
  metadata?: Record<string, unknown>;
};

export type Evaluator = {
  name: string;
  kind: AnnotatorKind;
  evaluate: (
    args: EvaluatorParams
  ) => Promise<EvaluationResult> | EvaluationResult;
};

export type EvaluationResult = {
  score: number | null;
  label: string | null;
  metadata: Record<string, unknown>;
  explanation: string | null;
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
