import {
  CreateEvaluatorArgs,
  EvaluationResult,
  Evaluator,
  OptimizationDirection,
} from "../types";

/**
 * Base class for llm evaluation metrics / scores
 */
export abstract class LLMEvaluator<RecordType extends Record<string, unknown>>
  implements Evaluator<RecordType>
{
  readonly name: string;
  readonly kind = "LLM" as const;
  readonly optimizationDirection?: OptimizationDirection;
  constructor({ name, optimizationDirection }: CreateEvaluatorArgs) {
    this.name = name;
    this.optimizationDirection = optimizationDirection;
  }
  abstract evaluate(_example: RecordType): Promise<EvaluationResult>;
}
