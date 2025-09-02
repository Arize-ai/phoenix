import { EvaluationResult, Evaluator, OptimizationDirection } from "../types";

/**
 * Base class for llm evaluation metrics / scores
 */
export class LLMEvaluator<ExampleType extends Record<string, unknown>>
  implements Evaluator<ExampleType>
{
  readonly name: string;
  readonly source = "LLM" as const;
  readonly optimizationDirection?: OptimizationDirection;
  constructor({ name }: { name: string }) {
    this.name = name;
  }
  async evaluate(_example: ExampleType): Promise<EvaluationResult> {
    throw new Error("evaluator.evaluate not implemented");
  }
}
