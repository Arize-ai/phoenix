import {
  EvaluationResult,
  Evaluator,
  OptimizationDirection,
  CreateEvaluatorArgs,
} from "../types";

/**
 * Base class for llm evaluation metrics / scores
 */
export abstract class LLMEvaluator<ExampleType extends Record<string, unknown>>
  implements Evaluator<ExampleType>
{
  readonly name: string;
  readonly source = "LLM" as const;
  readonly optimizationDirection?: OptimizationDirection;
  constructor({ name, optimizationDirection }: CreateEvaluatorArgs) {
    this.name = name;
    this.optimizationDirection = optimizationDirection;
  }
  abstract evaluate(_example: ExampleType): Promise<EvaluationResult>;
}
