import { LanguageModel } from "ai";
import { WithTelemetry } from "./otel";

/**
 * A specific AI example that is under evaluation
 */
export interface ExampleRecord<OutputType, InputType> {
  output: OutputType;
  expected?: OutputType;
  input?: InputType;
  [key: string]: unknown;
}

export interface WithLLM {
  model: LanguageModel;
}

export interface LLMEvaluationArgs extends WithLLM {}

/**
 * The result of an evaluation
 */
export interface EvaluationResult {
  /**
   * The score of the evaluation.
   * @example 0.95
   */
  score?: number;
  /**
   * The label of the evaluation.
   * @example "correct"
   */
  label?: string;
  /**
   * The explanation of the evaluation.
   * @example "The model correctly identified the sentiment of the text."
   */
  explanation?: string;
}

/**
 * The result of a classification
 */
export interface ClassificationResult {
  label: string;
  explanation?: string;
}

/**
 * The choice (e.g. the label and score mapping) of a classification based evaluation
 */
export interface ClassificationChoice {
  label: string;
  score: number;
}

/**
 * A mapping of labels to scores
 */
export type ClassificationChoicesMap = Record<string, number>;

/**
 * The arguments for creating a classification-based evaluator
 */
export interface CreateClassifierArgs extends WithTelemetry {
  /*
   * The LLM to use for classification / evaluation
   */
  model: LanguageModel;
  /**
   * The choices to classify the example into.
   * e.g. { "correct": 1, "incorrect": 0 }
   */
  choices: ClassificationChoicesMap;
  /**
   * The prompt template to use for classification
   */
  promptTemplate: string;
}

export interface CreateClassificationEvaluatorArgs
  extends CreateClassifierArgs {
  name: string;
  optimizationDirection: OptimizationDirection;
}

export type EvaluatorFn<ExampleType extends Record<string, unknown>> = (
  args: ExampleType
) => Promise<EvaluationResult>;

/**
 * The source of the evaluation
 */
type EvaluationSource = "LLM" | "CODE";

/**
 * The direction to optimize the numeric evaluation score
 * E.x. "MAXIMIZE" means that the higher the score, the better the evaluation
 */
type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";

/**
 * The Base Evaluator interface
 * This is the interface that all evaluators must implement
 */
export interface Evaluator<ExampleType extends Record<string, unknown>> {
  /**
   * The name of the evaluator / the metric that it measures
   */
  name: string;
  /**
   * The source of the evaluation. Also known as the "kind" of evaluator.
   */
  source: EvaluationSource;
  /**
   * The direction to optimize the numeric evaluation score
   * E.x. "MAXIMIZE" means that the higher the score, the better the evaluation
   */
  optimizationDirection: OptimizationDirection;
  /**
   * The function that evaluates the example
   */
  evaluate: EvaluatorFn<ExampleType>;
}
