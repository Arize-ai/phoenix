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
 * The directions to optimize the numeric evaluation score.
 *
 * Declared as a runtime tuple so the Zod enum in the code-evaluator draft
 * schema can derive its values from the same source as the type below.
 */
export const EVALUATOR_OPTIMIZATION_DIRECTIONS = [
  "MAXIMIZE",
  "MINIMIZE",
  "NONE",
] as const;

/**
 * The direction to optimize the numeric evaluation score
 * E.x. "MAXIMIZE" means that the higher the score, the better the evaluation
 */
export type EvaluatorOptimizationDirection =
  (typeof EVALUATOR_OPTIMIZATION_DIRECTIONS)[number];

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

export type ContinuousEvaluatorAnnotationConfig = {
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
   * The lower bound of the annotation
   */
  lowerBound?: number | null;
  /**
   * The upper bound of the annotation
   */
  upperBound?: number | null;
};

export type FreeformEvaluatorAnnotationConfig = {
  name: string;
  optimizationDirection: EvaluatorOptimizationDirection;
  threshold?: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

/**
 * The kind of evaluator
 */
export type EvaluatorKind = "LLM" | "CODE" | "BUILTIN";

/**
 * The languages a code evaluator may be authored in.
 *
 * Declared as a runtime tuple so the Zod enum in the code-evaluator draft
 * schema can derive its values from the same source as the type below.
 */
export const CODE_EVALUATOR_LANGUAGES = ["PYTHON", "TYPESCRIPT"] as const;

export type CodeEvaluatorLanguage = (typeof CODE_EVALUATOR_LANGUAGES)[number];

export type SandboxBackendType =
  | "WASM"
  | "E2B"
  | "DAYTONA"
  | "VERCEL"
  | "DENO"
  | "MODAL";

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
  metadata: Record<string, unknown>;
};
