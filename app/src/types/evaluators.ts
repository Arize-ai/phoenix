/**
 * The parameters that are passed to the evaluator execution
 * @example
 * {
 *   output: {
 *     "answer": "The capital of France is Paris"
 *   },
 *   reference: {
 *     "answer": "The capital of France is Paris"
 *   },
 * }
 *
 * The pseudo code for the evaluator execution would be:
 * ```
 * evaluator(output, reference, input)
 *   return score
 * ```
 */
export type EvaluatorParams = {
  /**
   * The output of the task that is being evaluated
   */
  output: Record<string, unknown>;
  /**
   * The reference output of the task that is being evaluated
   */
  reference: Record<string, unknown>;
  /**
   * The input of the task that is being evaluated
   * @example
   * {
   *   "question": "What is the capital of France?",
   * }
   */
  input: Record<string, unknown>;
  /**
   * The metadata of the task that is being evaluated
   */
  metadata?: Record<string, unknown>;
};

/**
 * How to map from the upstream data of an evaluator (e.x. a dataset example, a span)
 * to the parameters of the evaluator or in some cases the variables of an LLM Evaluator
 * @example
 * {
 *   "input": "input.question",
 *   "output": "output.answer",
 * }
 *
 * the value of the key is a JSONPath expression that is evaluated on the upstream data.
 *
 * If a value is left empty, the key will be set to the value of the upstream data.
 *
 */
export type EvaluatorInputMapping = {
  literalMapping: Record<string, boolean | string | number>;
  pathMapping: Record<string, string>;
};

/**
 * The direction to optimize the numeric evaluation score
 * E.x. "MAXIMIZE" means that the higher the score, the better the evaluation
 */
export type EvaluatorOptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";

/**
 * The choice a classification form of evaluation may choose from
 * @example
 * {
 *   "label": "positive",
 *   "score": 1,
 * }
 */
export type ClassificationChoice = {
  label: string;
  score?: number;
};

/**
 * A classification evaluator's annotation configuration
 */
export type ClassificationEvaluatorAnnotationConfig = {
  /**
   * The name of the annotation produced by the evaluator
   * @example
   * "helpfulness"
   */
  name: string;
  /**
   * The direction to optimize the numeric evaluation score
   * E.x. "MAXIMIZE" means that the higher the score, the better the evaluation
   */
  optimizationDirection: EvaluatorOptimizationDirection;
  /**
   * The choices that the evaluator may choose from
   */
  values: ClassificationChoice[];
};

/**
 * The kind of evaluator
 */
export type EvaluatorKind = "LLM" | "CODE";

/**
 * The source data for evaluator input mappings.
 *
 * This object contains all of the context that input mappings are applied against
 * to extract values for an evaluator.
 */
export type EvaluatorMappingSource = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reference: Record<string, unknown>;
};
