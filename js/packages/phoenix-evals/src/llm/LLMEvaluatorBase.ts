import { EvaluatorBase } from "../core/EvaluatorBase";
import { CreateLLMEvaluatorArgs } from "../types";

/**
 * Base class for llm evaluation metrics / scores
 */
export abstract class LLMEvaluatorBase<
  RecordType extends Record<string, unknown>,
> extends EvaluatorBase<RecordType> {
  constructor({ ...args }: CreateLLMEvaluatorArgs<RecordType>) {
    super({ kind: "LLM", ...args });
  }
}
