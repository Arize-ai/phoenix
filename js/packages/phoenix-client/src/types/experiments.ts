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
export interface ExperimentRunsMap<TaskOutputType = TaskOutput> {
  runs: Record<ExperimentRunID, ExperimentRun<TaskOutputType>>;
}

/**
 * An experiment that has been run and been recorded on the server
 */
export interface RanExperiment<TaskOutputType = TaskOutput>
  extends ExperimentInfo,
    ExperimentRunsMap<TaskOutputType> {
  evaluationRuns?: ExperimentEvaluationRun[];
}

/**
 * The result of running an experiment on a single example
 */
export interface ExperimentRun<TaskOutputType = TaskOutput> extends Node {
  startTime: Date;
  endTime: Date;
  /**
   * What experiment the run belongs to
   */
  experimentId: string;
  datasetExampleId: string;
  output: TaskOutputType | null;
  error: string | null;
  traceId: string | null;
}

export type EvaluatorParams<
  TaskOutputType, // Place first since this is the minimum
  InputType,
  ExpectedType,
> = {
  /**
   * The input field of the Dataset Example
   */
  input: InputType;
  /**
   * The output of the task
   */
  output: TaskOutputType | null;
  /**
   * The expected or reference output of the Dataset Example
   */
  expected?: ExpectedType;
  /**
   * Metadata associated with the Dataset Example
   */
  metadata?: Example["metadata"];
};

export type ExperimentEvaluator<
  TaskOutputType = TaskOutput, // Place first since this is the minimum
  InputType extends Example["input"] = Example["input"],
  ExpectedType extends Example["output"] = Example["output"],
> = {
  name: string;
  kind: AnnotatorKind;
  evaluate: (
    args: EvaluatorParams<TaskOutputType, InputType, ExpectedType>
  ) => Promise<ExperimentEvaluationResult> | ExperimentEvaluationResult;
};

export type ExperimentEvaluationResult = {
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
  result: ExperimentEvaluationResult | null;
  /**
   * The trace id of the evaluation
   * This is null if the trace is deleted or never recorded
   */
  traceId: string | null;
}

export type TaskOutput = string | boolean | number | object | null | undefined;

export type ExperimentTask<
  ExampleType extends Example = Example,
  TaskOutputType = TaskOutput,
> = (example: ExampleType) => Promise<TaskOutputType> | TaskOutputType;

export interface ExperimentParameters {
  /**
   * The number of examples to run the experiment on
   */
  nExamples: number;
}
