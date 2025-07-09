import { LanguageModel } from "ai";

/**
 * The arguments for an evaluation
 */
export interface EvaluationArgs<OutputType, InputType> {
  output: OutputType;
  expected?: OutputType;
  input?: InputType;
  [key: string]: unknown;
}

export interface WithLLM {
  model: LanguageModel;
}

export interface LLMEvaluationArgs<OutputType, InputType>
  extends EvaluationArgs<OutputType, InputType>,
    WithLLM {}

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
