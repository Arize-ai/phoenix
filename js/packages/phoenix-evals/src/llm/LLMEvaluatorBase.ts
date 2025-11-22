import { EvaluatorBase } from "../core/EvaluatorBase";
import { CreateLLMEvaluatorArgs } from "../types";

/**
 * Base class for llm evaluation metrics / scores
 */
export abstract class LLMEvaluator<
  RecordType extends Record<string, unknown>,
> extends EvaluatorBase<RecordType> {
  constructor({
    name,
    optimizationDirection,
    inputMapping,
  }: CreateLLMEvaluatorArgs<RecordType>) {
    super({ name, kind: "LLM", optimizationDirection, inputMapping });
  }
}
