import { LanguageModel } from "ai";

/**
 * The arguments for an evaluation
 */
export interface EvaluationArgs<OutputType, InputType> {
  output: OutputType;
  expected?: OutputType;
  input: InputType;
}

export interface LLMEvaluationArgs<OutputType, InputType>
  extends EvaluationArgs<OutputType, InputType> {
  model: LanguageModel;
}

/**
 * The result of an evaluation
 */
export interface EvaluationResult {
  /**
   * The score of the evaluation.
   * e.x. 0.95
   */
  score: number;
  /**
   * The label of the evaluation.
   * e.x. "correct"
   */
  label: string;
  /**
   * The explanation of the evaluation.
   * e.x. "The model correctly identified the sentiment of the text."
   */
  explanation: string;
}

/**
 * The result of a classification evaluation
 */
export interface ClassificationEvaluationResult
  extends Omit<EvaluationResult, "score"> {}
